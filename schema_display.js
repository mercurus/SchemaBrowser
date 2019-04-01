//Read index.html for overview
//===================================================================================
// SETUP v
//===================================================================================

window.onload = init;
window.onresize = scaleDisplay;

var sorted_tables = [];
var last_selected_table = "";

function init() {
	//get all table names from schema
	for(var table_name in schema) {
		sorted_tables.push(table_name);
	}
	
	//sort before we insert into combobox
	sorted_tables.sort(function(a, b) {
		if(a > b) return 1;
		if(a < b) return -1;
		return 0;
	});
	
	//created options and add to select
	var combo_tables = document.getElementById("combo_tables");	
	for(var i = 0; i < sorted_tables.length; i++) {
		combo_tables.appendChild(newElement("option", sorted_tables[i], {"value": sorted_tables[i]}));
	}
	
	//showTable("accounts");
	//showEnum("accounts", "password_level");
	scaleDisplay();
}

function scaleDisplay() {
	var display_container = document.getElementById("display_container");
	var wrapper_height = document.getElementById("wrapper").offsetHeight;
	var control_panel_height = 90; //constant so we can always fit tags
	var max_height = ((wrapper_height - control_panel_height) / wrapper_height) * 100 - 1;
	display_container.style.maxHeight = max_height + "%";
	centerPopup();
}

//===================================================================================
// SETUP ^
//===================================================================================
// TABLES AND TAGS v
//===================================================================================

function showTable(table_name) {
	var display_container = document.getElementById("display_container");
	var selected_table = document.getElementById(table_name);
	
	//does table exist?
	if(table_name == null || schema[table_name] == null) {
		//alert("Table " + table_name + " does not exist");
		return;
	}
	
	//is table being displayed ? goto : create
	if(selected_table != null) {
		scrollToDiv(table_name);
		return;
	}
		
	//dynamically create DOM elements
	var the_div = newElement("div", null, {"id": table_name, "class":"table_div"});
	var the_table = newElement("table");
	
	//header for table name and close X
	the_div.appendChild(newElement("h3", table_name));
	the_div.appendChild(newElement("span", "X", {"class":"table_tag clicky", "onclick":"removeTableAndTag('" + table_name + "');"}));
	
	//table header row
	var headers = ["Name", "Datatype", "Nullable", "Default", "Etc"];
	var tr = newElement("tr");
	for(var h = 0; h < headers.length; h++) {
		tr.appendChild(newTD(newElement("p", headers[h], {"class":"table_header"})));
	}
	the_table.appendChild(tr);
	
	//get fields and sort
	var field_names = [];
	for(var field_name in schema[table_name].fields) {
		field_names.push(field_name);
	}
	
	//sort fields on sequence since objects aren't ordered
	field_names.sort(function(a, b) {
		var aa = schema[table_name].fields[a]["sequence"];
		var bb = schema[table_name].fields[b]["sequence"];
		if(aa > bb) return 1;
		if(aa < bb) return -1;
		return 0;
	});
	
	//field definitions
	for(var c = 0; c < field_names.length; c++) {
		var tr = newElement("tr");
		var field_name = field_names[c];
		var fk_table = schema[table_name].fields[field_name]["fkTable"];
		var fk_field = schema[table_name].fields[field_name]["fkField"];
		
		//if field is a foreign key or an enumeration, create a link
		if(fk_table) {
			tr.appendChild(newTD(newElement("span", field_name, 
				{"class":"clicky", "onclick":"showTable('" + fk_table + "');", "title":"FK: " + fk_table + " . " + fk_field})));
		}
		else if(enumerators[table_name] != null && enumerators[table_name][field_name] != null) {
			tr.appendChild(newTD(newElement("span", field_name, 
				{"class":"clicky_enum", "onclick":"showEnum('" + table_name + "', '" + field_name + "');", "title": enumerators[table_name][field_name]["java_type"]})));
		}
		else {
			tr.appendChild(newElement("td", field_name));
		}
		
		tr.appendChild(newElement("td", schema[table_name].fields[field_name]["datatype"]));
		tr.appendChild(newElement("td", schema[table_name].fields[field_name]["nullable"]));
		tr.appendChild(newElement("td", schema[table_name].fields[field_name]["defaultValue"]));
		tr.appendChild(newElement("td", schema[table_name].fields[field_name]["comment"]));
		the_table.appendChild(tr);
	}
	
	//append table to div
	the_div.appendChild(the_table);
	
	//constraints
	var all_constraints = "", the_constraint = "";
	for(var c = 0; c < schema[table_name].constraints.length; c++) {
		the_constraint = schema[table_name].constraints[c];
		
		//if the constraint is a view, change commas to line breaks for easier readability
		if(the_constraint.includes(" VIEW ")) {
			the_constraint = the_constraint.split(",").join("<br/>");
		}
		
		all_constraints = all_constraints + the_constraint + "<br/>";
	}
	the_div.appendChild(newElement("h3", "Constraints"));
	the_div.appendChild(newElement("p", all_constraints, {"class":"constraints"}));
	
	//now to display
	addTableTag(table_name);
	display_container.insertBefore(the_div, display_container.firstChild);
	display_container.scrollTop = 0;
}

function addTableTag(table_name) {
	//initial get and create
	var all_table_tags = document.getElementById("all_table_tags");
	var the_div = newElement("div", null, {"class":"table_tag", "id": table_name + "_tag"});
	
	//table name and close X
	the_div.appendChild(newElement("span", table_name, {"class":"tag_text clicky", "onclick":"scrollToDiv('" + table_name + "');"}));
	the_div.appendChild(newElement("span", "X", {"class":"tag_text clicky", "onclick":"removeTableAndTag('" + table_name + "');"}));
	
	if(last_selected_table != "") { //first time
		all_table_tags.insertBefore(the_div, document.getElementById(last_selected_table + "_tag"));
	}
	else {
		all_table_tags.appendChild(the_div);
	}
	last_selected_table = table_name;
}

function removeTableAndTag(table_name) {
	//remove all
	if(table_name == "*") {
		var display_container = document.getElementById("display_container");
		var all_table_tags = document.getElementById("all_table_tags");
		while(display_container.firstChild) {
			display_container.removeChild(display_container.firstChild);
		}
		while(all_table_tags.firstChild) {
			all_table_tags.removeChild(all_table_tags.firstChild);
		}
		all_table_tags.appendChild(newElement("span", "Table tags: ", {"style":"float:left"}));
	}
	//remove one
	else {
		var full_table = document.getElementById(table_name);
		var table_tag = document.getElementById(table_name + "_tag");
		document.getElementById("display_container").removeChild(full_table);
		document.getElementById("all_table_tags").removeChild(table_tag);
	}
}

function scrollToDiv(table_name) {
	var panel_height = document.getElementById("control_panel").offsetHeight;
	var top_position = document.getElementById(table_name).offsetTop;
	var margin_of_class_table_div = 20;
	document.getElementById("display_container").scrollTop = top_position - panel_height - margin_of_class_table_div;
}

//===================================================================================
// TABLES AND TAGS ^
//===================================================================================
// COMMANDS v
//===================================================================================

function textEnter(event) {
	var raw_text = document.getElementById("text_input").value.toLowerCase().trim();
	var first_char = raw_text.substring(0, 1);
	var the_text = raw_text.substring(1, raw_text.length);
		
	//blank or not enter key? we're not interested
	if(raw_text.length == 0 || event.keyCode != 13) {
		return;
	}
	
	else if(first_char == "!") {
		actionCommand(the_text);
	}
	else if(first_char == "@") {
		showTablesITouch(the_text);
	}
	else if(first_char == "#") {
		showTablesThatTouchMe(the_text);
	}
	else if(first_char == "$") {
		showTableGroup(the_text);
	}
	else {
		searchForField(raw_text);
	}
	
	//blank out text
	document.getElementById("text_input").value = "";
}

// !commands
function actionCommand(the_text) {
	var all_table_tags = document.getElementById("all_table_tags");
	
	if(the_text == "commands" || the_text == "help" || the_text == "") {
		var msg = 	"Search by field name or\n" +
					"!showall\n" +
					"!closeall\n" +
					"!showtags\n" +
					"!hidetags\n" +
					"@table\n" +
					"#table";
		for(var group_name in table_groups) {
			msg = msg + "\n$" + group_name;
		}
		alert(msg);
	}
	else if(the_text == "showall") {
		//really show all?
		if(confirm("Really show all " + sorted_tables.length + " tables?")) {
			//AP has ~140 tables, don't always want all those tags
			if(sorted_tables.length > 20) {
				all_table_tags.style.display = "none";
				alert("Table tags are now hidden because there are many tables. Show them again with !showtags");
			}
			
			removeTableAndTag("*");
			//reverse order since they're inserted at the top
			for(var i = sorted_tables.length - 1; i >= 0; i--) {
				showTable(sorted_tables[i]);
			}
		}
	}
	else if(the_text == "closeall") {
		removeTableAndTag("*");
	}
	else if(the_text == "showtags") {
		all_table_tags.style.display = "block";
	}
	else if(the_text == "hidetags") {
		all_table_tags.style.display = "none";
	}
	else {
		alert("Command " + the_text + " not recognized");
	}
}

// @table
function showTablesITouch(the_table) {
	//opens the table and all tables it contains a foreign key
	if(the_table == "table" || the_table == "help" || the_table == "") {
		alert("Use @ to open a table and all other tables it relates to");
	}
	//check if exists
	else if(schema[the_table] != null) {
		removeTableAndTag("*");
		//loop through fields, find foreign keys and show the table
		for(var field_name in schema[the_table].fields) {
			//null fk values get handled in showTable()
			showTable(schema[the_table].fields[field_name]["fkTable"]);
		}
		showTable(the_table);
	}
	else {
		alert("Table " + the_table + " not found");
	}
}

// #table
function showTablesThatTouchMe(the_table) {
	//opens the table and all tables it contains a foreign key
	if(the_table == "table" || the_table == "help" || the_table == "") {
		alert("Use # to open it and all tables that relate to it");
	}
	//check if exists
	else if(schema[the_table] != null) {
		removeTableAndTag("*");
		//loop through all tables, find foreign key references to this one
		
		for(var table_name in schema[the_table].fields) {
			//null fk values get handled in showTable()
			showTable(schema[the_table].fields[field_name]["fkTable"]);
		}
		
		
		showTable(the_table);
	}
	else {
		alert("Table " + the_table + " not found");
	}
}

// $group
function showTableGroup(the_group) {
	if(the_group == "group" || the_group == "help" || the_group == "") {
		alert("Use $ and a group name from table_groups.js to open all tables in that group");
	}
	//check if exists
	else if(table_groups[the_group] != null && table_groups[the_group].length > 0) {
		removeTableAndTag("*");
		for(var i = table_groups[the_group].length - 1; i >= 0 ; i--) {
			showTable(table_groups[the_group][i]);
		}
	}
	else {
		alert("Group " + the_group + " not found");
	}
}

//===================================================================================
// COMMANDS ^
//===================================================================================
// POPUP v
//===================================================================================

function searchForField(the_text) {
	var matches = []; //will be a 2d array (because you can't sort objects), first element of each being table name
	var count_fields = 0, current_index = -1, current_table = "";
	
	//loop through all fields and see if they contain the_text
	//was going to go with key:value pairs but some tables might have multiple matches
	//so instead it will be a series of arrays
	for(var table in schema) {
		for(var field in schema[table].fields) {
			if(field.includes(the_text)) {
				//initialize array if necessary
				if(current_table != table) {
					current_table = table;
					current_index++;
					matches[current_index] = [];
					matches[current_index].push(table);
				}
				matches[current_index].push(field);
				count_fields++;
			}
		}
	}
	
	var show_search = true;
	if(count_fields == 0) {
		alert("No matches found for: " + the_text);
		show_search = false;
	}
	//if there's a boat load of matches, prompt before burying the user in them
	else if(count_fields > 50) {
		show_search = confirm("There are " + count_fields + " matched fields. Display all?");
	}
	//leave?
	if(!show_search) {
		return;
	}

	//time to display
	var popup = document.getElementById("popup");
	
	//empty self
	while(popup.firstChild) {
		popup.removeChild(popup.firstChild);
	}
	
	//header and close X
	popup.appendChild(newElement("h3", "Matched fields"));
	popup.appendChild(newElement("span", "X", {"class":"table_tag clicky", "onclick":"hidePopup();"}));
	
	//table and header row
	var the_table = newElement("table");
	var tr = newElement("tr");
	tr.appendChild(newTD(newElement("p", "Table", {"class":"table_header"})));
	tr.appendChild(newTD(newElement("p", "Field", {"class":"table_header"})));
	the_table.appendChild(tr);
	
	//sort tables by name, first element being the table name
	matches.sort(function(a, b) {
		if(a[0] > b[0]) return 1;
		if(a[0] < b[0]) return -1;
		return 0;
	});
	
	//loop through matched tables and show all matched fields
	for(var t = 0; t < matches.length; t++) {
		//create row and link to table
		var tr = newElement("tr");
		tr.appendChild(newTD(newElement("span", matches[t][0], {"class":"clicky", "onclick":"hidePopup(); showTable('" + matches[t][0] + "');"})));
		
		//matched fields
		var all_fields = matches[t][1];
		for(var f = 2; f < matches[t].length; f++) {
			 all_fields = all_fields + "<br/>" + matches[t][f];
		}
		tr.appendChild(newElement("td", all_fields));
		
		//append row to table
		the_table.appendChild(tr);
	}
	
	//append table and show popup
	popup.appendChild(the_table);
	showPopup();
}

function showEnum(table, field) {
	var popup = document.getElementById("popup");
	
	//empty self
	while(popup.firstChild) {
		popup.removeChild(popup.firstChild);
	}
	
	//header and close X
	popup.appendChild(newElement("h3", table + "." + field));
	popup.appendChild(newElement("span", "X", {"class":"table_tag clicky", "onclick":"hidePopup();"}));
	popup.appendChild(newElement("p", "Java type - " + enumerators[table][field]["java_type"], {"style":"clear: both"}));
	
	//table and header row
	var the_table = newElement("table");
	var tr = newElement("tr");
	tr.appendChild(newTD(newElement("p", "Database value", {"class":"table_header"})));
	tr.appendChild(newTD(newElement("p", "Meaning", {"class":"table_header"})));
	the_table.appendChild(tr);
	
	
	//sort enums in array since objects aren't ordered
	var sorted_enums = [];
	for(var enum_value in enumerators[table][field]) {
		if(enum_value != "java_type") {
			sorted_enums.push(enum_value);
		}
	}
	sorted_enums.sort(function(a, b) {
		//if they're numbers convert from string, otherwise we get 0 1 10 11... 2 3 4
		if(!isNaN(a)) a = parseInt(a);
		if(!isNaN(b)) b = parseInt(b);
		if(a > b) return 1;
		if(a < b) return -1;
		return 0;
	});
	
	//loop through enums and create a row for each
	for(var i = 0; i < sorted_enums.length; i++) {
		var tr = newElement("tr");
		tr.appendChild(newElement("td", sorted_enums[i]));
		tr.appendChild(newElement("td", enumerators[table][field][sorted_enums[i]]));
		the_table.appendChild(tr);
	}
	
	//append table and show popup
	popup.appendChild(the_table);
	showPopup();
}

function hidePopup() {
	document.getElementById("popup").style.visibility = "hidden";
}

function showPopup() {
	centerPopup();
	document.getElementById("popup").scrollTop = 0;
	document.getElementById("popup").style.visibility = "visible";
}

function centerPopup() {
	//called from showPopup() and scaleDisplay()
	var popup = document.getElementById("popup");
	var full_h = document.getElementById("wrapper").offsetHeight;
	var full_w = document.getElementById("wrapper").offsetWidth;
	var h = popup.offsetHeight;
	var w = popup.offsetWidth;
	popup.style.left = ((full_w / 2) - (w / 2)) + "px";
	popup.style.top = ((full_h / 2) - (h / 2)) + "px";
}

//===================================================================================
// POPUP ^
//===================================================================================
// HELPERS
//===================================================================================

function newTD(e) {
	var td = document.createElement("td");
	td.appendChild(e);
	return td; 
}

//sometimes I use this function for new TDs 
//because the other one appends the parameter/element
//while this one sets the innerHTML
function newElement(type, text, options) {
	var e = document.createElement(type);
	if(text != null) {
		e.innerHTML = text;
	}
	for(var key in options) {
		e.setAttribute(key, options[key]);
	}
	return e;
}

