
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.util.ArrayList;
/* requires java-json.jar */
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
/* to deal with all that JSON noise */

public class TemplateParser {
	
	public TemplateParser() {
	}
	
	public static void main(String[] args) throws JSONException, IOException {
		//can be ran from the command line 
		//if you pass the template (including path presumably) as the first parameter
		//and the output file as the second parameter
		String template = args.length < 1 ? "C:\\Users\\Ryan.Hunt\\Documents\\SQL\\prod\\templates\\ap_template.sql" : args[0];
		String output = args.length < 2 ? "C:\\Users\\Ryan.Hunt\\Documents\\AP_Documentation\\template_parser\\var_schema.js" : args[1];
		TemplateParser tp = new TemplateParser();
		tp.parseTemplate(template, output);
	}
	
	//===================================================================================
	// PARSE FUNCTIONS
	//===================================================================================
	
	public void parseTemplate(String fileInput, String fileOutput) throws JSONException, IOException {
		ArrayList<sqlTable> database_schema = new ArrayList<sqlTable>();
		String currentLine = "", currentTableString = "", currentTableName = "";
		BufferedReader br = null;
		BufferedWriter bw = null;
		final int SEEKING_TABLE = 0, DEFINING_TABLE = 1;
		int scanState = SEEKING_TABLE;
	
		try {
			//open file
			br = new BufferedReader(new FileReader(fileInput));
			
			//scan loop
			while ((currentLine = br.readLine()) != null) {
				if(scanState == SEEKING_TABLE && containsIgnoreCase(currentLine, "CREATE TABLE")) {
					//we found a table, so reset the local variables
					currentTableString = "";
					currentTableName = currentLine.split("`")[1]; 
					scanState = DEFINING_TABLE;
				}
				else if(scanState == DEFINING_TABLE && !containsIgnoreCase(currentLine, ") ENGINE")) {
					//keep grabbing table definitions, line by line
					//readLine() removes the line break, so we add it back in to split on later
					//we could instead keep adding to an ArrayList, but a single split into a plain array just seems easier
					currentTableString += currentLine + "\n";
				}
				else if(scanState == DEFINING_TABLE && containsIgnoreCase(currentLine, ") ENGINE")) {
					//table definition ended, so parse into object and add to schema 
					database_schema.add(parseTable(currentTableName, currentTableString));
					scanState = SEEKING_TABLE;
				}
				else if(scanState == SEEKING_TABLE && containsIgnoreCase(currentLine, " VIEW ")) {
					//some tables are actually views, but are declared as both a table and later as a view in the template
					//the table declaration creates all fields as tinyints not null
					//so we want to take the view definition and add it as the constraint on the table
					sqlTable view = parseView(currentLine);
					for(sqlTable schema_table : database_schema) {
						if(view.name.equals(schema_table.name)) {
							schema_table.constraints.add(view.constraints.get(0));
						}
					}
				}
				else {
					//nothing. read lines until it's interesting
				}
			}
		} catch(IOException e) {
			e.printStackTrace();
		} finally {
			if(br != null) br.close();
		}
		
		//display java objects 
		for(sqlTable theTable : database_schema) {
			System.out.println(theTable.name);
			for(sqlField theField : theTable.fields) {
				fieldToConsole(theField);
			}
			System.out.println("----------------");
		}
		
		//template has been parsed into java objects, now let's convert to JSON
		JSONObject schema = new JSONObject();
		for(sqlTable theTable : database_schema) {
			schema.put(theTable.name, tableToJSON(theTable));
		}
		
		//and finally write the JSON object to a javascript file
		String var = "var schema = " + schema.toString() + ";";
		try {
			bw = new BufferedWriter(new FileWriter(fileOutput));
			bw.write(var);
		} catch (IOException e ) {
			e.printStackTrace();
		} finally {
			if(bw != null) bw.close();
		}
	}
	
	public sqlTable parseTable(String tableName, String tableString) {
		sqlTable baseTable = new sqlTable(tableName);
		String[] tableArray = tableString.split("\\n");
		String currentLine;
		int sequence = 0;
		
		//analyze each line in the table definition, create appropriate fields or constraints in baseTable
		for(int i = 0; i < tableArray.length; i++) {
			//trim, and remove trailing comma if exists
			currentLine = tableArray[i].trim();
			if(currentLine.substring(currentLine.length() - 1).equals(",")) {
				currentLine = currentLine.substring(0, currentLine.length() - 1);
			}
			
			//lines that start with ` mean field definition
			if(currentLine.startsWith("`")) {
//				fieldToConsole(parseField(currentLine));
				baseTable.fields.add(parseField(currentLine, sequence++));
			}
			//else means some kind of constraint, and we only care about foreign keys
			else {
				if(containsIgnoreCase(currentLine, "FOREIGN KEY")) {
					baseTable.setForeignKey(parseForeignKey(currentLine));
				}
				
				//finally add the raw constraint text to be displayed underneath fields
				baseTable.constraints.add(currentLine);
			}
		}
		
		return baseTable;
	}
	
	public sqlField parseField(String plainText, int sequence) {
//		http://dev.mysql.com/doc/refman/5.7/en/create-table.html
		
//		create_definition:
//		    col_name column_definition
//		  | [CONSTRAINT [symbol]] PRIMARY KEY [index_type] (index_col_name,...)
//		      [index_option] ...
//		  | {INDEX|KEY} [index_name] [index_type] (index_col_name,...)
//		      [index_option] ...
//		  | [CONSTRAINT [symbol]] UNIQUE [INDEX|KEY]
//		      [index_name] [index_type] (index_col_name,...)
//		      [index_option] ...
//		  | {FULLTEXT|SPATIAL} [INDEX|KEY] [index_name] (index_col_name,...)
//		      [index_option] ...
//		  | [CONSTRAINT [symbol]] FOREIGN KEY
//		      [index_name] (index_col_name,...) reference_definition
//		  | CHECK (expr)

//		column_definition:
//		    data_type [NOT NULL | NULL] [DEFAULT default_value]
//		      [AUTO_INCREMENT] [UNIQUE [KEY] | [PRIMARY] KEY]
//		      [COMMENT 'string']
//		      [COLUMN_FORMAT {FIXED|DYNAMIC|DEFAULT}]
//		      [STORAGE {DISK|MEMORY|DEFAULT}]
//		      [reference_definition]

		//example field definitions:
		//`last_modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
		//`preferred_date_format` int(10) unsigned DEFAULT NULL COMMENT 'Format that the user prefers to see their date display as.  Ex: 09/14/2014 vs 14/09/2014',
		//`5Digit FIPS County` tinyint NOT NULL,
		
		//the local sqlField being populated and returned
		sqlField currentField = new sqlField();
		
		//can't split on space initially because some field names have a space in them (zip_coordinate_mapping)
		//definitions[] skips the field name 
		String[] definitions = plainText.split("`")[2].split(" ");
		String allComments = ""; //for comments, auto_increment, character set, stuff we don't care about
		
		//since there are so many optional keywords in a field definition 
		//we use idx to track the index in definitions[] that's being evaluated
		int idx = 1; 
		int maxIdx = definitions.length;
		
		//sequence tracks the order/position in which to display fields because javascript doesn't maintain the order of a collection of objects
		currentField.sequence = sequence;
		//not definitions[0] because if we only split on [space] then we'd mess up column names that include spaces
		currentField.name = plainText.split("`")[1];
		
		//first value after name is always datatype
		currentField.datatype = definitions[idx];
		if(++idx >= maxIdx) return currentField; //this increments the index we're evaluating, and exits if it was the last index
		
		//numeric datatypes may have [SIGNED | UNSIGNED] [ZEROFILL]
		if(containsIgnoreCase(definitions[idx], "signed")) {
			currentField.datatype = currentField.datatype + " " + definitions[idx];
			if(++idx >= maxIdx) return currentField;
		}
		if(containsIgnoreCase(definitions[idx], "zerofill")) {
			currentField.datatype = currentField.datatype + " " + definitions[idx];
			if(++idx >= maxIdx) return currentField;
		}
		
		//string datatypes may have [CHARACTER SET charset_name] [COLLATE collation_name]
		if(containsIgnoreCase(definitions[idx], "character")) {
			if(containsIgnoreCase(definitions[idx + 1], "set")) {
				allComments = definitions[idx] + " " + definitions[idx + 1] + " " + definitions[idx + 2] + " ";
				idx += 3; //character = 1, set = 2, [value] = 3
				if(idx >= maxIdx) return currentField;
			}
			else {
				System.out.println("CHARACTER not followed by SET?");
				//System.exit(0);
			}
		}
		if(containsIgnoreCase(definitions[idx], "collate")) {
			allComments = allComments + definitions[idx] + " " + definitions[idx + 1] + " ";
			idx += 2; //collate = 1, [value] = 2
			if(idx >= maxIdx) return currentField;
		}
		
		//[NOT NULL | NULL]
		if(containsIgnoreCase(definitions[idx], "not")) {
			if(containsIgnoreCase(definitions[idx + 1], "null")) {
				currentField.nullable = definitions[idx] + " " + definitions[idx + 1];
				idx += 2; //not = 1, null = 2
				if(idx >= maxIdx) return currentField;
			}
			else {
				System.out.println("NOT not followed by NULL?");
				//System.exit(0);
			}
		}
		else if(containsIgnoreCase(definitions[idx], "null")) {
			currentField.nullable = definitions[idx];
			if(++idx >= maxIdx) return currentField;
		}

		//[DEFAULT default_value]
		if(containsIgnoreCase(definitions[idx], "default")) {
			idx++; //increment immediately since we don't care about "DEFAULT", just the value
			
			//default fields are surrounded by quotes. if this value has a quote on the left but not on the right, 
			//then the default value had a space (like a datetime) and we need to find the last element
			String quoteDelimiter = definitions[idx].substring(0, 1);
			if(quoteDelimiter.equals("\"") || quoteDelimiter.equals("'")) {
				//default value starts with a quote, so check if it also ends with a quote
				int dl = definitions[idx].length();
				if(definitions[idx].substring(dl - 1, dl).equals(quoteDelimiter)) {
					currentField.defaultValue = definitions[idx].substring(1, dl - 1); //substring to take out quotes
				}
				//else element didn't have its closing quote, so now we've gotta find it
				else {
					int startIdx = idx;
					String fullDefault = "";
					
					//increment the index until we find a value that ends with the same quote delimiter
					do {
						idx++;
					} while(idx < maxIdx && !definitions[idx].substring(definitions[idx].length() - 1, definitions[idx].length()).equals(quoteDelimiter));
					
					//now concatenate the elements together
					for(int i = startIdx; i < idx + 1; i++) {
						fullDefault = fullDefault + definitions[i] + " ";
					}
					
					currentField.defaultValue = fullDefault;
				}
				if(++idx >= maxIdx) return currentField;
			}
			//else means default_value wasn't surrounded by quotes, probably null
			else {
				currentField.defaultValue = definitions[idx];
				if(++idx >= maxIdx) return currentField;
			}
		}
		
		//anything else is fluff like key, auto_increment, comment. toss em all in together
		for(int i = idx; i < maxIdx; i++) {
			allComments = allComments + definitions[i] + " ";
		}
		currentField.comment = allComments;		
		
		return currentField;
	}
	
	public sqlField parseForeignKey(String rawConstraint) {
		//[CONSTRAINT [symbol]] FOREIGN KEY [index_name] (index_col_name,...) reference_definition
		//CONSTRAINT `account_npo_ibfk_9` FOREIGN KEY (`secondary_focus_id`) REFERENCES `central`.`area_of_focus` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
		//0           1                  2              3                  4             5       6 7                8  9
		
		sqlField fk = new sqlField();
		String[] keywords = rawConstraint.split("`");
		
		for(int k = 0; k < keywords.length; k++) {
			if(containsIgnoreCase(keywords[k], "FOREIGN KEY")) {
				fk.name = keywords[k + 1];
			}
			else if(containsIgnoreCase(keywords[k], "REFERENCES")) {
				//if table references central then we skip ahead two indices
				if(keywords[k + 1].equals("central") && keywords[k + 2].equals(".")) {
					k += 2;
				}
				fk.fkTable = keywords[k + 1];
				fk.fkField = keywords[k + 3];
				//System.out.println(fk.fkTable + " " + fk.fkField);
				break; //not really necessary, but we're done so lets save a nanosecond
			}
		}
		
		return fk;
	}
	
	public sqlTable parseView(String rawView) {
		//example: 
		///*!50001 VIEW `catalog_entry_keywords` AS select `central`.`catalog_entry_keywords`.`catalog_entry_id` AS `catalog_entry_id`,`central`.`catalog_entry_keywords`.`keyword` AS `keyword`,`central`.`catalog_entry_keywords`.`weight` AS `weight` from `central`.`catalog_entry_keywords` */
		String viewName = rawView.split("`")[1];
		sqlTable view = new sqlTable(viewName);
		view.constraints.add(rawView);
		return view;
	}
	
	//===================================================================================
	// HELPER FUNCTIONS
	//===================================================================================
	
	public void fieldToConsole(sqlField f) {
		String comment = f.name;
		if(!isEmpty(f.datatype)) comment = comment + ", datatype: " + f.datatype;
		if(!isEmpty(f.nullable)) comment = comment + ", nullable: " + f.nullable;
		if(!isEmpty(f.defaultValue)) comment = comment + ", default: " + f.defaultValue;
		if(!isEmpty(f.comment)) comment = comment + ", comment: " + f.comment;
		System.out.println(comment);
	}
	
	public boolean isEmpty(String s) {
	  return s == null || s.trim().isEmpty();
	}
	
	public boolean containsIgnoreCase(String haystack, String needle) {
		haystack = haystack.toLowerCase();
		needle = needle.toLowerCase();
		return haystack.contains(needle);
	}
	
	public JSONObject tableToJSON(sqlTable theTable) throws JSONException {
		JSONObject json = new JSONObject();
		JSONObject fields = new JSONObject();
		for(sqlField theField : theTable.fields) {
			fields.put(theField.name, fieldToJSON(theField));
		}
		json.put("fields", fields);
		
		JSONArray constraints = new JSONArray();
		for(String theConstraint : theTable.constraints) {
			constraints.put(theConstraint);
		}
		json.put("constraints", constraints);
		
		return json;
	}
	
	public JSONObject fieldToJSON(sqlField theField) throws JSONException {
		JSONObject json = new JSONObject();
		json.put("datatype", theField.datatype);		
		json.put("nullable", theField.nullable);
		json.put("defaultValue", theField.defaultValue);
		json.put("comment", theField.comment);
		json.put("sequence", theField.sequence);
		json.put("fkTable", theField.fkTable);
		json.put("fkField", theField.fkField);
		return json;
	}

	//===================================================================================
	// INTERNAL CLASSES (basically structs)
	//===================================================================================

	class sqlTable {
		public String name;
		public ArrayList<sqlField> fields;
		public ArrayList<String> constraints;
		
		public sqlTable(String n) {
			name = n;
			fields = new ArrayList<sqlField>();
			constraints = new ArrayList<String>();
		}
		
		public void setForeignKey(sqlField theField) {
			for(sqlField candidate : fields) {
				if(candidate.name.equals(theField.name)) {
					candidate.fkTable = theField.fkTable;
					candidate.fkField = theField.fkField; 
				}
			}
		}
	}
	
	class sqlField {
		public String name, datatype, nullable, defaultValue, comment, fkTable, fkField;
		public int sequence;
		
		public sqlField() {
			name = datatype = nullable = defaultValue = comment = fkTable = fkField = null;
			sequence = 0;
		}
		
		//unused
		public sqlField(String _name, String _datatype, String _nullable, String _default, String _comment) {
			name = _name;
			datatype = _datatype;
			nullable = _nullable;
			defaultValue = _default;
			comment = _comment;
		}
	}
}