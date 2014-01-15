/*
 * SQL to JSON
 *
 * Copyright (c) 2014 Martin Drapeau
 */
CSVJSON.sql2json = function() {

	var errorEmpty = "Please upload a file or type in something.";

	var uploadUrl = "/sql2json/upload";
	
	var $file = $('#fileupload'),
		$format = $('input[type=radio][name=format]'),
		$sql = $('#sql'),
		$result = $('#result'),
		$clear = $('#clear, a.clear'),
		$convert = $('#convert, a.convert');
	
	function err(error) {
		CSVJSON.reportError($result, error);
		return false;
	}
	
	$convert.click(function(e) {
		e.preventDefault();
		var sql = _.trim($sql.val());
		if (sql.length == 0) return err(errorEmpty);
		
		var format = $format.filter(':checked').val();
		
		// Remove comments and empty lines, and collapse statemnts on one line
		sql = sql
				// Remove comments
				.replace(/(?:\/\*(?:[\s\S]*?)\*\/)|(?:([\s;])+\/\/(?:.*)$)/gm, '$1')
				.replace(/^--.*[\r\n]/gm, "")
				// Remove empty lines
				.replace(/^\s*[\r\n]/gm, "")
				// Collapse statements (TO DO: Convert this to a single regex)
				.replace(/;\s*[\r\n]/gm, ";;")
				.replace(/[\r\n]/gm, "")
				.replace(/;;/gm, ";\n");
		//$result.val(sql); return;
		
		var lines = _.lines(sql);
		if (lines.length == 0) return err(errorEmpty);
		
		// Split into tables
		var tables = {}, l, line;
		try {
			for (l = 0; l < lines.length; l++) {
				line = lines[l],
					words = _.words(line);
				if (!words.length) continue;
				
				if (words.length >= 3 &&
					words[0].toUpperCase() == 'CREATE' &&
					words[1].toUpperCase() == 'TABLE') {
					var name = _.trim(words[2], "`'\"");
					tables[name] = {
						header: [],
						values: []
					};
					var values = _(line).chain().strRight("(").strLeftBack(")").words(",").value();
					tables[name].header = _.reduce(values, function(result, value) {
						var words = _.words(value);
						if (!words.length)
							throw "Cannot find columns for table " + name;
						var first = _.trim(words[0]);
						if (_.startsWith(first, "'") || _.startsWith(first, "`") || _.startsWith(first, '"'))
							result.push(_.trim(first, "`'\""));
						return result;
					}, []);
					if (!tables[name].header.length)
						throw "No columns found for table " + name;
				}
				else if (words.length >= 3 &&
					words[0].toUpperCase() == 'INSERT' &&
					words[1].toUpperCase() == 'INTO') {
					var name = _.trim(words[2], "`'\"");
					if (!tables[name])
						throw "Table "+name+" was not defined in a CREATE TABLE.";
					var table = tables[name];
					var values = _(line).chain().strRight("(").strLeftBack(")").words(",").value();
					if (!values.length)
						throw "No values found for table " + name;
					tables[name].values.push(_.map(values, function(value) {
						return _.trim(value, " `'\"");
					}));
				}
			}
		} catch(error) {
			return err("Error: " + error + "\n..." + line);
		}
		//$result.val(JSON.stringify(tables, null, 2)); return;
		
		// Convert to json now
		var	json = {};
		_.each(tables, function(table, name) {
			var keys = table.header;
			json[name] = _.map(table.values, function(values) {
				var o = {};
				for (var k=0; k < keys.length; k++)
					o[keys[k]] = values[k];
				return o;
			});
		});
		
		// Output requested format
		var result = '';
		if (format == "json")
			result = JSON.stringify(json, null, 2);
		else
			result = _.reduce(json, function(result, table, name) {
				return result + "var " + name + " = " + JSON.stringify(table, null, 2) + ";\n";
			}, '');
		
		$result.removeClass('error').val(result);
	});
	
	CSVJSON.start({
		$convert: $convert,
		$clear: $clear,
		$save: $('input.save, textarea.save'),
		upload: {
			$file: $file,
			url: uploadUrl,
			$textarea: $sql
		}
	});
};