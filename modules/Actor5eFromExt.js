/*
29-Sep-2020     Created
30-Sep-2020     Mapping template: provide the key and the default if it's not found (because some defaults are empty arrays etc)
1-Oct-2020      v0.4.2: Embed functions in the mapping template to guide specific calculations
				basically replaces inline code in an importer/constructor
				Handle: lowercase languages, flags which are True/Off -> 1/0, trim " " to null
				v0.4.3: Add calculations/functions for Skills. Here value = 0,1, or 2 depending on Not Prof/Prof/Expertise
				Not implmenting any bonuses or other adjustments, and we're hoping the totals will recalculate automatically
2-Oct-2020      v0.4.3a: createFoundryActor(): Imports the JSON just created.
3-Oct-2020      v0.5.0: Renamed to more generic PC Importer and make Actor5eFromMPMB a subclass of Actor5eFromExt
				Will need more work to make it more truly object-oriented, including separating out generic
				input XML and JSON handling
5-Oct-2020      v0.5.0b: Extract the Class and Level information from the Class Features tag - initially don't handle multi-class
				(Actually looked at "Class and Levels" but that occurs TWICE at the root level, and isn't necessarily consistent)
				Pull all global functions into Actor5eFromMPMB and reference pcImporter mapping function
6-Oct-2020      v0.5.1: Extract the Spell information - add TemplateSpellItemData
				Move all of the calls to Actor5eFromMPMB in here and use this.actorData rather than this
8-Oct-2020      v0.6.0: Add Actor5eFromFG
19-Oct-2020     v0.6.1: Fix size setting from MPMB (number) to Foundry (code) - added mapAndLookup
20-Oct-2020     v0.6.1b: MPMB: Switch to using AdvLog.Class and Levels for multi-classes
				(will also need to add a mapper from MPMB subclass names to standard D&D - we do that internally
				  for known ones but then allow for homebrew/custom)
				Switch back to Class Features, but now extract blocks for each class
				and then loop through the block to find the subclass  
21-Oct-2020		v0.6.1c: MPMB: Create items - simple match or create the item as Loot
				(We will want to add other known details such as # and weight for later manual matching)
				v0.6.1d: MPMB - Extract feats and features from "Class Features"
						Change createEmbeddedEntity to batch update
						Switch/simplift lookup and ordering of matchItems
						Include (partial) Feature description if you don't match
21-Oct-2020		v0.6.1e: Bug fixes: Intimidation proficiency missing
						fuzzyMatch -> findBestMatch scoring by word matches
						This seems at least as good as the previous method although it is giving some false positives
						Bug: Need to remove :'s and also store what the original match was
						Bug: Items are being duplicated because of tradegoods and items
22-Oct-2020	v0.6.1f: matchItems(): Loop over itemType, item, and then pack that might match
					Add extractFeats()
					findBestMatch(): Subtract non-matches in both target and comparison
*/

import {MODULE_NAME, PCImporter} from "./PCImporter.js";
import Actor5e from "/systems/dnd5e/module/actor/entity.js";    //default export
import Item5e from "/systems/dnd5e/module/item/entity.js";    //default export


export class Actor5eFromExt {
	//Contains the Actor5e data and eventually the created Foundry object
	constructor(pcImporter) {
		this.pcImporter = pcImporter;
		this.actor = null;      //Foundry created Actor
		this.actorData = {};       //actor data used to create/update Actor
		this.itemData = {};         //Keep this separate for subsequent matching and creation - might be able to re-integrate
	}

	mapAndIterate(subMappingTree, subObject) {
		for (const entry of Object.entries(subMappingTree)) {
			const entryProperty = entry[0];
			const entryValue = entry[1];
			//If itself an object, then keep on drilling down
			//0.4.2 Have to run it through the mapper because we have both legitimate nested objects
			//and also the special mapping objects like {fieldName: , default: }
			let mappedValue = this.mapToImportedField(entryValue);
			subObject[entryProperty] = mappedValue;
		}
		return subObject;
	}

	mapToImportedField(entryValue) {
		//v0.4.2 Allow for different forms of the mapping variable
		//  null -> do nothing
		//  {fieldName, default} -> look up the fieldName (if present); use the default if not found
		//  String -> look up the fieldName and use null if not found
		// Array -> do all these things for each element of the array
		// Empty object - will probably become null
		let mappedValue;
		if (!entryValue) {
			mappedValue = mappedValue;  //Works if the default is null or 0
		} else if (Array.isArray(entryValue)) {
			//Not sure this will handle all possibilities
			//Should handle both the empty array [] and also [fieldName1, fieldName2, ....]
			const mappedArray = [];
			entryValue.forEach(elem => {
				const mappedArrayValue = this.mapToImportedField(elem);
				if (mappedArrayValue) {mappedArray.push(mappedArrayValue);}
			});
			mappedValue = mappedArray;
		} else if (entryValue.fieldName) {
			mappedValue = this.pcImporter.getValueForFieldName(entryValue.fieldName);
			if (!mappedValue) {mappedValue = entryValue.default ? entryValue.default : null}
		} else if (typeof entryValue === 'function') {
			const f = entryValue.bind(this);
			mappedValue = f();
		} else if (entryValue.default) {
			mappedValue = entryValue.default;
		} else if (typeof entryValue === 'object') {
			//This is for the nested form of the mapping template
			const subObject = {}
			mappedValue = this.mapAndIterate(entryValue, subObject);
		} else {
			//Trims spaces from beginning and end (so turns " " into "")
			mappedValue = this.pcImporter.getValueForFieldName(entryValue);
			if (typeof mappedValue === 'string') {mappedValue = mappedValue.trim();}
		}
		//FXIME: Do some clean-up - would be better if this could be done inline
		if (mappedValue ==="Off") {mappedValue = false;}
		if (mappedValue === "") {mappedValue = null;}
		return mappedValue;
	}

	mapArray(fieldNames) {
		const fieldNameArray = Array.from(fieldNames);
		let mappedArray = [];
		fieldNameArray.forEach((fieldName, i) => {
			const mappedValue = this.pcImporter.getValueForFieldName(fieldName);
			if (mappedValue && (mappedValue !== " ")) {mappedArray.push(mappedValue);}
		});
		return mappedArray;
	}

	mapAndSwitchToInteger( fieldName) {
		const switchValue = this.pcImporter.getValueForFieldName(fieldName);
		if (switchValue === "Off") {return 0;}
		else if (switchValue === "True") {return 1;}
		else {return 0;}
	}
	mapConvertAndAdd(fieldNames) {
		//Used for turning Proficiency + Expertise -> 0, 1, or 2 (which is what Foundry wants)
		if (!fieldNames || !fieldNames.length || !Array.isArray(fieldNames)) {return 0;}
		const converted = fieldNames.map(k => this.pcImporter.getValueForFieldName(k));
		const added = converted.reduce((sum,c) => sum + (c==="True" ? 1 : 0),0);
		return added;
	}

	mapAndLookup(fieldName, lookupTable) {
	  //Map the fieldName to a result in the dictionary and then lookup that result to convert
	  //it to the equivalent Foundry value (for example, size)
	  if (!fieldName || !lookupTable) return null;
	  const dictionaryVal = this.pcImporter.getValueForFieldName(fieldName);
	  const convertedVal = lookupTable.get(dictionaryVal);
	  return convertedVal;
	}

	exportToJSON(createFile=true) {
		let data = duplicate(this);
		let allData = null;

		const dataAsJSON = JSON.stringify(data, null, 2);

		// Trigger file save procedure
		if (createFile) {
			const filename = `fvtt-${this.actorData.name}.json`;
			saveDataToFile(dataAsJSON, "text/json", filename);
		}
		return dataAsJSON;
	}

	async createFoundryActor() {
		let actorData = duplicate(this.actorData);
		const options = {temporary: false, renderSheet: false}
//FIXME: Do an update if this actor already exists?? Should always be starting the import on an existing Actor for safety
		this.actor = await Actor5e.create(actorData, options);

		//Now do the matching - do this on the created Actor so that we pull Items from the Compendium directly into the
		//Actor rather than having to create intermediate values
//FIXME: Would like to move this before Actor creation and reference spells etc. - look at JSON import?
		await this.matchItems();
	}



	async matchItems() {
		if (!this.itemData || !this.itemData.items) {return;}
		//Match spells, classes, items, feats
		let allItemsData = [];
		for (const [itemType, packNames] of Object.entries(itemTypeToPackNames)) {
			
			//Note that item.type for "item" is actually defaulted to "loot"
			for (const item of this.itemData.items.filter(item => item.type === itemType)) {
				let fullItem = null;	//a match in the packs, or just record as is
				for (const packName of packNames) {
					let pack = game.packs.get(packName);
					let packIndex;
					if (pack) {packIndex = await pack.getIndex();}
					if (!packIndex ) {continue;}
					
					//findBestMatch scores best with all words matching and none extra
					const foundItemIndex = Actor5eFromExt.findBestMatch(packIndex,item.name);
					if (foundItemIndex && foundItemIndex._id) {
						fullItem = await pack.getEntity(foundItemIndex._id);
						if (fullItem && fullItem.data) {
							//Nothing extra to do if it's a known spell or item
							if (item.type === "class") {
								//For classes, we augment with our knowledge of subclass and level
								fullItem.data.data.levels = item.data.levels;
								fullItem.data.data.subclass = item.data.subclass;
							}
							break;	//We found a good match, so skip searching any other packs
						}
					}
				}//end for packNames
//FIXME: Will want to add additional known info in flags
				if (!fullItem) {
					fullItem = {};
					//Especially for items, but also for other types, make a copy for manual matching
					fullItem.data = duplicate(item);
				}
				if (fullItem && fullItem.data) {allItemsData.push(fullItem.data);}
			}//end for items
		}//end for itemTypes
		//Create all items in batch - using the same logic as Actor5e/base.js/_onDropItemCreate
		await this.actor.createEmbeddedEntity("OwnedItem", allItemsData);
	}//end matchItems()

	static findBestMatch(stringIndex, stringToMatch) {
		if (!stringIndex || !stringToMatch) {return null;}
		//Ranks matches by word , with 1 for all words matches and 0 for none
		//Still probably won't be able to distinguish that Tenser's Floating Disk === Floating Disk
		//but Magic Missiile != Jim's Magic Missile 
		//Try to short-circuit with full name match
		let foundIndex = stringIndex.find(s => s.name === stringToMatch);
		if (!foundIndex) {
			const splitRegEx = /[^A-Za-z0-9]/;
			//Break the stringToMatch into words which we will then search for
			const mixedWordArray = stringToMatch.trim().split(splitRegEx).filter(s => s !== "");
			const wordArray = mixedWordArray.map(w => w.toLowerCase());
			let numberOfWords = wordArray.length;
			let maxMatches = 0;

			stringIndex.forEach(e => {
				const eArray = e.name.split(splitRegEx).filter(s => s !== "");
				const numMatches = eArray.filter(elem => wordArray.includes(elem.toLowerCase())).length;
				const nonMatches = (eArray.length - numMatches) + (wordArray.length - numMatches);
				const adjMatches = numMatches - nonMatches;	//reduce match if there were words left over
				if (adjMatches > maxMatches) {
					maxMatches = adjMatches;
					foundIndex = e;
				}
			});
		}
		return foundIndex;
	}
}

export class Actor5eFromFG extends Actor5eFromExt {
	/** @override */
	constructor(pcImporter) {
		super(pcImporter);
	}

	static async create(pcImporter) {
		//Populate the Actor5e structure from the importedFieldToValuesMap
		const importedActor = new Actor5eFromFG(pcImporter);

		//IMPORTING

		//See https://stackoverflow.com/questions/8085004/iterate-through-nested-javascript-objects
		//Use recursion (only 3 levels deep) to walk through the mapping tree and object in parallel
		importedActor.mapAndIterate(Actor5eToFGMapping, importedActor.actorData); //create the base Actor

		//Now iterate through available Item-like objects in the input object
		//Classes - do this more functionally and not declaratively

		await importedActor.extractClasses();
/*        await importedActor.extractSpells();
*/
		return importedActor;
	}

	async extractClasses() {
		/** @override */
		//Getting class information is straightforward in FG

		let classItemData = duplicate(TemplateClassItemData);
		classItemData.name = this.pcImporter.getValueForFieldName("classes.id-00001.name");
		classItemData.data.levels = this.pcImporter.getValueForFieldName("classes.id-00001.level");
		classItemData.data.subclass = null;
		//0.5.2 Don't create a new item here - wait until we see if we can match a compendium
		//const newClassItem = await Item5e.create(classItemData);
		this.itemData.items = [classItemData];
	}
}


//The item types coming from MPMB -> the dnd5e pack(s) to use -> what we should label unknown items
const itemTypeToPackNames = {
	"spell" : ["dnd5e.spells"],
	"loot" : ["dnd5e.tradegoods", "dnd5e.items"], 	//"loot" will be the default type if not found
	"class" : ["dnd5e.classes"],
	"feat" : ["dnd5e.classfeatures"]
}

export class Actor5eFromMPMB extends Actor5eFromExt {
	/** @override */
	constructor(pcImporter) {
		super(pcImporter);
	}

	static async create(pcImporter) {
		//Populate the Actor5e structure from the importedFieldToValuesMap
		const importedActor = new Actor5eFromMPMB(pcImporter);

		//IMPORTING
		//See https://stackoverflow.com/questions/8085004/iterate-through-nested-javascript-objects
		//Use recursion (only 3 levels deep) to walk through the mapping tree and object in parallel
		importedActor.mapAndIterate(Actor5eToMPMBMapping, importedActor.actorData); //create the base Actor

		//Now iterate through available Item-like objects in the input object
		//Classes - do this more functionally and not declaratively
//FIXME: Kick these off asynchronously and then wait for them all to finish		
		await importedActor.extractClasses();
		await importedActor.extractFeats();
		await importedActor.extractSpells();
		await importedActor.extractItems();
		return importedActor;
	}



	async extractClasses() {
		/** @override */
		let match;
		let classLevelMatches = new Set(); 
		this.itemData.items = [];
		//v0.6.1: Try using "Class and Levels" to get the overall class/subclass and level
		//which appears in the form "subclass1 n1,subclass2 n2"
		//subclass can contain () and spaces, but we don't capture them at the beginning or end
		//The problem is that we end up with two unrecognizable strings without further processing
/*        
		const classAndLevelRegExp = /((?:[A-Za-z()]+\s?)+)\s(\d{1,2})(?:,|$)/g;

	   const mappedValue = this.pcImporter.getValueForFieldName("Class and Levels");
		if (!mappedValue) {return;}

		while (match = classAndLevelRegExp.exec(mappedValue)) {
		  classLevelMatches.add([match[1], match[2]]);
		  let classItemData = duplicate(TemplateClassItemData);
		  classItemData.name = match[1];
		  classItemData.data.levels = match[2];
		  classItemData.data.subclass = match[1];
		  this.itemData.items.push(classItemData);
		}
*/
		//Unfortunately the base class is not used consistently, but rather the sub-class
		//<v0.6.0 approach: So instead we pull the class from the 1st Level feature gained (assuming there always is one)
		//v0.6.1: However we use the learning from above "Class and Levels extraction"
		const mappedValue = this.pcImporter.getValueForFieldName("Class Features");
		if (!mappedValue) {return;}
		//Get overall class level from the header line but ignore the class name which is not useful
		//Then get class name from "(xyz 1" and sub-classes from "(xyz nn" programattically
		//Use the lazy match to match on the first class name (otherwise it will match to the end)
		const levelsAndClassesRegExp = /level ([0-9]+):[\s\S]+?\(([A-Za-z]+) 1[^0-9](?:(?!,\slevel)[\s\S])*/g;

		while (match = levelsAndClassesRegExp.exec(mappedValue)) {
			let classItemData = duplicate(TemplateClassItemData);
			classItemData.fullMatch = match[0];
			classItemData.name = match[2];
			classItemData.data.levels = match[1];
			this.itemData.items.push(classItemData);
		}  

		//Now we reprocess these segments to get the features and the subclass name
		//The subclass can be stored with the class name, but we create additional items for the features
		//Get <new line><bullet etc>Feature Name<space>(subclass-name nn)
		const featuresAndSubClassRegExp = /^(?:[^A-Za-z])*([A-Za-z ]+) \(([A-Za-z ]+) \d{1,2}/gm;  //extract sub-classes from "(xyz nn"

		this.itemData.items.forEach((classItemData,i) => {
			//Get first [name][space][number] combination that doesn't match the previously extracted class name
			while (match = featuresAndSubClassRegExp.exec(classItemData.fullMatch)) {
				//Now find the subclass which doesn't match the class name
				if (match[2] !== classItemData.name)  {
					classItemData.data.subclass = match[2];
					//Don't break here because we want to store the features
				}
				//And store the separate features
				const featureItemData = duplicate(TemplateFeatData);
				featureItemData.name = match[1];
//FIXME: Change the match to get all the text up to the next match				
				featureItemData.data.description.value = match[0];
				this.itemData.items.push(featureItemData);
			}
			delete this.itemData.items[i].fullMatch;    
		}); 
	}

	async extractSpells() {
		//const frontSpells = this.pcImporter.getValuesForPattern("P[0-9].SSfront.spells.name");
		//const moreSpells = this.pcImporter.getValuesForPattern("P[0-9].SSmore.spells.name");
		const allSpells = this.pcImporter.getValuesForPattern(".SS(?:front|more)+.spells.name");
		//Get all unique values
		const allUniqueSpells = [...(new Set(allSpells))];
		//FIXME we'd like to get level as well to improve the chance of a match later
		for (const spellName of allUniqueSpells) {
			let spellItemData = duplicate(TemplateSpellItemData);
			spellItemData.name = spellName;
			//const newSpellItem = await Item5e.create(spellItemData);
			this.itemData.items.push(spellItemData);
		}
	}


	async extractFeats() {
		const extractedFeats = this.pcImporter.getValuesForPattern(/Feat Name [1-9]/);
		for (const featName of extractedFeats) {
		  let featData = duplicate(TemplateFeatData);
		  featData.name = featName;
		  this.itemData.items.push(featData);
		}
	  }

	async extractItems() {
	  const allItems = this.pcImporter.getValuesForPattern(/Adventuring Gear Row \d{1,2}/);
	  for (const itemName of allItems) {
		let itemData = duplicate(TemplateItemData);
		itemData.name = itemName;
		this.itemData.items.push(itemData);
	  }
	}


}

//MPMB mapping Provides the mapping to the field names in the XFDF
const Actor5eToMPMBMapping = {
	  "name": "AdvLog.PC Name",
	  "type": () => "character",
	  "flags": {
		"exportSource": {
		  "world": null,
		  "system": {default: "dnd5e"},
		  "coreVersion": {default: "0.6.6"},
		  "systemVersion": {default: "0.96"}
		},
		"dnd5e": {},
		"core": {
		  "sheetClass": {default: ""}
		},
		"PC Importer" : {default: "0.6.0"}
	  },
	  "data": {
		"abilities": {
		  "str": {
			"value": "Str",
			"proficient":  function(fieldName="Str ST Prof") {return this.mapAndSwitchToInteger(fieldName);},
			"mod": "Str Mod",
			"prof": 0,      //Don't need to set? Is calculated?
			"saveBonus": 0,     //Only if you have an item (e.g. +1 CLoak of Resistance)
			"checkBonus": 0,
			"save": "Str ST Mod"
		  },
		  "dex": {
			"value": "Dex",
			"proficient": function(fieldName="Dex ST Prof") {return this.mapAndSwitchToInteger(fieldName);},
			"mod": "Dex Mod",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Dex ST Mod"
		  },
		  "con": {
			"value": "Con",
			"proficient":  function(fieldName="Con ST Prof") {return this.mapAndSwitchToInteger(fieldName);},
			"mod": "Con Mod",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Con ST Mod"
		  },
		  "int": {
			"value": "Int",
			"proficient":  function(fieldName="Int ST Prof") {return this.mapAndSwitchToInteger(fieldName);},
			"mod": "Int Mod",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Int ST Mod"
		  },
		  "wis": {
			"value": "Wis",
			"proficient":  function(fieldName="Wis ST Prof") {return this.mapAndSwitchToInteger(fieldName);},
			"mod": "Wis Mod",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Wis ST Mod"
		  },
		  "cha": {
			"value": "Cha",
			"proficient": function(fieldName="Cha ST Prof") {return this.mapAndSwitchToInteger(fieldName);},
			"mod": "Cha Mod",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Cha ST Mod"
		  }
		},
		"attributes": {
		  "ac": {
			"value": "AC"
		  },
		  "hp": {
			"value": "HP Current",
			"min": 0,
			"max": "HP Max",
			"temp": "HP Temp",
			"tempmax": 0
		  },
		  "init": {
			"value": 0,
			"bonus": 0,
			"mod": 0,
			"prof": 0,
			"total": "Initiative bonus"
		  },
		  "spellcasting": null,
		  "speed": {
			"value": "Speed",
			"special": null
		  },
		  "death": {
			"success": null,
			"failure": null
		  },
		  "encumbrance": {
			"value": 0,
			"max": 150,
			"pct": 0,
			"encumbered": false
		  },
		  "exhaustion": null,
		  "inspiration": "Inspiration",
		  "hd": "HD1 Level",
		  "prof": "Proficiency Bonus",
		  "spelldc": "Spell save DC 1"
		},
		"details": {
		  "biography": {
			"value": null,
			"public": "Background History"
		  },
		  "alignment": "Alignment",
		  "race": "Race",
		  "background": "Background",
		  "xp": {
			"value": "Total Experience",
			"min": null,
			"max": null,
			"pct": null
		  },
		  "trait": "Personality Trait",
		  "ideal": "Ideal",
		  "bond": "Bond",
		  "flaw": "Flaw",
		  "level": "Character Level"
		},
		"traits": {
		  "size": function(fieldName="Size Category") {return this.mapAndLookup(fieldName,sizeMap);},
		  "di": {
			"value": [],
			"custom": null
		  },
		  "dr": {
			"value":  function() {return lowercaseArray(this.mapArray( ["Resistance Damage Type 1","Resistance Damage Type 2","Resistance Damage Type 3","Resistance Damage Type 4","Resistance Damage Type 5"]));},
			"custom": null
		  },
		  "dv": {
			"value": [],
			"custom": null
		  },
		  "ci": {
			"value": [],
			"custom": null
		  },
		  "senses": "Vision",
		  "languages": {
			"value":  function() {return lowercaseArray(this.mapArray( ["Language 1","Language 2","Language 3","Language 4","Language 5"]));},
			"custom": null
		  },
		  "weaponProf": {
			"value": [],
			"custom": null
		  },
		  "armorProf": {
			"value": [],
			"custom": null
		  },
		  "toolProf": {
			"value": [],
			"custom": null
		  }
		},
		"currency": {
		  "pp": "Platinum Pieces",
		  "gp": "Gold Pieces",
		  "ep": "Electrum Pieces",
		  "sp": "Silver Pieces",
		  "cp": "Copper Pieces"
		},
		"skills": { //"bonus" is global bonus, for example from item, magic or otherwise
		  "acr": {  //Acrobatics
			"value":  function(fieldNames=["Acr Exp","Acr Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "dex",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "ani": {  //Animal handling
			"value": function(fieldNames=["Ani Exp","Ani Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "arc": {  //Arcana
			"value": function(fieldNames=["Arc Exp","Arc Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "ath": {  //Athletics
			"value": function(fieldNames=["Ath Exp","Ath Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "str",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "dec": {  //Deception
			"value": function(fieldNames=["Dec Exp","Dec Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "cha",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "his": {  //History
			"value": function(fieldNames=["His Exp","His Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "ins": {  //Insight
			"value": function(fieldNames=["Ins Exp","Ins Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "itm": {	//Intimidation
			"value": function(fieldNames=["Inti Exp","Inti Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "cha",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "inv": {  //Investigation
			"value": function(fieldNames=["Inv Exp","Inv Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": "Inv Bonus",
			"mod":  null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "med": {  //Medicine
			"value": function(fieldNames=["Med Exp","Med Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "nat": {  //Nature
			"value": function(fieldNames=["Nat Exp","Nat Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "prc": {  //Perception
			"value": function(fieldNames=["Perc Exp","Perc Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": "Passive Perception"
		  },
		  "prf": {  //Performance
			"value": function(fieldNames=["Perf Exp","Perf Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "cha",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "per": {  //Persuasion
			"value": function(fieldNames=["Pers Exp","Pers Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "cha",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "rel": {  //Religion
			"value": function(fieldNames=["Rel Exp","Rel Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "slt": {  //Sleight of Hand
			"value": function(fieldNames=["Sle Exp","Sle Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "dex",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "ste": {  //Stealth
			"value": function(fieldNames=["Ste Exp","Ste Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "dex",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "sur": {  //Survival
			"value": function(fieldNames=["Sur Exp","Sur Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  }
		},
		"spells": {
		  "spell1": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl1",
			"override": null
		  },
		  "spell2": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl2",
			"override": null
		  },
		  "spell3": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl3",
			"override": null
		  },
		  "spell4": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl4",
			"override": null
		  },
		  "spell5": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl5",
			"override": null
		  },
		  "spell6": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl6",
			"override": null
		  },
		  "spell7": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl7",
			"override": null
		  },
		  "spell8": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl8",
			"override": null
		  },
		  "spell9": {
			"value": null,
			"max": "SpellSlots.CheckboxesSet.lvl9",
			"override": null
		  },
		  "pact": {
			"value": null,
			"max": null,
			"override": null,
			"level": null
		  }
		},
		"bonuses": {
		  "mwak": {
			"attack": null,
			"damage": null
		  },
		  "rwak": {
			"attack": null,
			"damage": null
		  },
		  "msak": {
			"attack": null,
			"damage": null
		  },
		  "rsak": {
			"attack": null,
			"damage": null
		  },
		  "abilities": {
			"check": null,
			"save": null,
			"skill": null
		  },
		  "spell": {
			"dc": null
		  }
		},
		"resources": {
		  "primary": {
			"value": null,
			"max": null,
			"sr": false,
			"lr": false,
			"label": null
		  },
		  "secondary": {
			"value": null,
			"max": null,
			"sr": false,
			"lr": false,
			"label": null
		  },
		  "tertiary": {
			"value": null,
			"max": null,
			"sr": false,
			"lr": false,
			"label": null
		  }
		}
	  },
	  "sort": null,
	  "token": {
		"flags": {},
		"name": null,
		"displayName": null,
		"img": "icons/svg/mystery-man.svg",
		"tint": null,
		"width": 1,
		"height": 1,
		"scale": 1,
		"lockRotation": false,
		"rotation": null,
		"vision": true,
		"dimSight": 60,
		"brightSight": null,
		"dimLight": null,
		"brightLight": null,
		"sightAngle": 360,
		"lightAngle": 360,
		"lightAlpha": 1,
		"actorId": null,
		"actorLink": true,
		"actorData": null,
		"disposition": 1,
		"displayBars": null,
		"bar1": {
		  "attribute": {default: "attributes.hp"}
		},
		"bar2": {
		  "attribute": ""
		},
		"randomImg": false
	},
	"_id": null,
	"img": null
  }

const sizeMap = new Map([["0.5", "tiny"], ["1", "sm"],["2","med"],["3","lg"]]);

//FG Mapping to Fantasy Grounds
const Actor5eToFGMapping = {
	  "name": "name",
	  "type": () => "character",
	  "flags": {
		"exportSource": {
		  "world": null,
		  "system": {default: "dnd5e"},
		  "coreVersion": {default: "0.6.6"},
		  "systemVersion": {default: "0.96"}
		},
		"dnd5e": {},
		"core": {
		  "sheetClass": {default: ""}
		},
		"PC Importer" : {default: "0.6.0"}
	  },
	  "data": {
		"abilities": {
		  "str": {
			"value": "abilities.strength.score",
			"proficient":  "abilities.strength.saveprof",
			"mod": "abilities.strength.bonus",
			"prof": 0,      //Don't need to set? Is calculated?
			"saveBonus": 0,     //Only if you have an item (e.g. +1 CLoak of Resistance)
			"checkBonus": 0,
			"save": "Str ST Mod"
		  },
		  "dex": {
			  "value": "abilities.dexterity.score",
			  "proficient":  "abilities.dexterity.saveprof",
			  "mod": "abilities.dexterity.bonus",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Dex ST Mod"
		  },
		  "con": {
			  "value": "abilities.constitution.score",
			  "proficient":  "abilities.constitution.saveprof",
			  "mod": "abilities.constitution.bonus",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Con ST Mod"
		  },
		  "int": {
			  "value": "abilities.intelligence.score",
			  "proficient":  "abilities.intelligence.saveprof",
			  "mod": "abilities.intelligence.bonus",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Int ST Mod"
		  },
		  "wis": {
			  "value": "abilities.wisdom.score",
			  "proficient":  "abilities.wisdom.saveprof",
			  "mod": "abilities.wisdom.bonus",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Wis ST Mod"
		  },
		  "cha": {
			  "value": "abilities.charisma.score",
			  "proficient":  "abilities.charisma.saveprof",
			  "mod": "abilities.charisma.bonus",
			"prof": 0,
			"saveBonus": 0,
			"checkBonus": 0,
			"save": "Cha ST Mod"
		  }
		},
		"attributes": {
		  "ac": {
			"value": "defenses.ac.total"
		  },
		  "hp": {
			"value": "hp.total",
			"min": 0,
			"max": "hp.total",
			"temp": "hp.temporary",
			"tempmax": 0
		  },
		  "init": {
			"value": 0,
			"bonus": 0,
			"mod": 0,
			"prof": 0,
			"total": "initiative.total"
		  },
		  "spellcasting": "int",
		  "speed": {
			"value": "speed.total",
			"special": null
		  },
		  "death": {
			"success": null,
			"failure": null
		  },
		  "encumbrance": {
			"value": 0,
			"max": "encumbrance.max",
			"pct": 0,
			"encumbered": false
		  },
		  "exhaustion": null,
		  "inspiration": "inspiration",
		  "hd": "HD1 Level",
		  "prof": "profbonus",
		  "spelldc": "Spell save DC 1"
		},
		"details": {
		  "biography": {
			"value": null,
			"public": "Background History"
		  },
		  "alignment": "Alignment",
		  "race": "race",
		  "background": "background",
		  "xp": {
			"value": "exp",
			"min": null,
			"max": null,
			"pct": null
		  },
		  "trait": "Personality Trait",
		  "ideal": "Ideal",
		  "bond": "Bond",
		  "flaw": "Flaw",
		  "level": "Character Level"
		},
		"traits": {
		  "size": "size",
		  "di": {
			"value": [],
			"custom": null
		  },
		  "dr": {
			"value":  [],
			"custom": null
		  },
		  "dv": {
			"value": [],
			"custom": null
		  },
		  "ci": {
			"value": [],
			"custom": null
		  },
		  "senses": "senses",
		  "languages": {
			"value":  function() {return lowercaseArray(this.mapArray( [
				"languagelist.id-00001.name","languagelist.id-00002.name","languagelist.id-00003.name","languagelist.id-00004.name","languagelist.id-00005.name","languagelist.id-00006.name",
			]));},
			"custom": null
		  },
		  "weaponProf": {
			"value": function() {return this.mapArray( ["proficiencylist.id-00001.name"]);},
			"custom": null
		  },
		  "armorProf": {
			"value": [],
			"custom": null
		  },
		  "toolProf": {
			"value": [],
			"custom": null
		  }
		},
		"currency": {
		  "pp": "coins.slot5.amount",
		  "gp": "coins.slot4.amount",
		  "ep": "coins.slot3.amount",
		  "sp":"coins.slot2.amount",
		  "cp": "coins.slot1.amount"
		},
		"skills": { //"bonus" is global bonus, for example from item, magic or otherwise
		  "acr": {  //Acrobatics
			"value":  function(fieldNames=["Acr Exp","Acr Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "dex",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "ani": {  //Animal handling
			"value": function(fieldNames=["Ani Exp","Ani Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "arc": {  //Arcana
			"value": function(fieldNames=["Arc Exp","Arc Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "ath": {  //Athletics
			"value": function(fieldNames=["Ath Exp","Ath Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "str",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "dec": {  //Deception
			"value": function(fieldNames=["Dec Exp","Dec Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "cha",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "his": {  //History
			"value": function(fieldNames=["His Exp","His Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "ins": {  //Insigh
			"value": function(fieldNames=["Ins Exp","Ins Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "itm": {
			"value": function(fieldNames=["Acr Exp","Acr Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "cha",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "inv": {  //Investigation
			"value": function(fieldNames=["Inv Exp","Inv Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": "Inv Bonus",
			"mod":  null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "med": {  //Medicine
			"value": function(fieldNames=["Med Exp","Med Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "nat": {  //Nature
			"value": function(fieldNames=["Nat Exp","Nat Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "prc": {  //Perception
			"value": function(fieldNames=["Perc Exp","Perc Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": "Passive Perception"
		  },
		  "prf": {  //Performance
			"value": function(fieldNames=["Perf Exp","Perf Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "cha",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "per": {  //Persuasion
			"value": function(fieldNames=["Pers Exp","Pers Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "cha",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "rel": {  //Religion
			"value": function(fieldNames=["Rel Exp","Rel Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "int",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "slt": {  //Sleight of Hand
			"value": function(fieldNames=["Sle Exp","Sle Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "dex",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "ste": {  //Stealth
			"value": function(fieldNames=["Ste Exp","Ste Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "dex",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  },
		  "sur": {  //Survival
			"value": function(fieldNames=["Sur Exp","Sur Prof"]) {return this.mapConvertAndAdd(fieldNames);},
			"ability": "wis",
			"bonus": null,
			"mod": null,
			"prof": null,
			"total": null,
			"passive": null
		  }
		},
		"spells": {
		  "spell1": {
			"value": null,
			"max": "powermeta.spellslots1.max",
			"override": null
		  },
		  "spell2": {
			"value": null,
			"max": "powermeta.spellslots2.max",
			"override": null
		  },
		  "spell3": {
			"value": null,
			"max": "powermeta.spellslots3.max",
			"override": null
		  },
		  "spell4": {
			"value": null,
			"max":"powermeta.spellslots4.max",
			"override": null
		  },
		  "spell5": {
			"value": null,
			"max": "powermeta.spellslots5.max",
			"override": null
		  },
		  "spell6": {
			"value": null,
			"max": "powermeta.spellslots6.max",
			"override": null
		  },
		  "spell7": {
			"value": null,
			"max": "powermeta.spellslots7.max",
			"override": null
		  },
		  "spell8": {
			"value": null,
			"max":"powermeta.spellslots8.max",
			"override": null
		  },
		  "spell9": {
			"value": null,
			"max": "powermeta.spellslots9.max",
			"override": null
		  },
		  "pact": {
			"value": null,
			"max": null,
			"override": null,
			"level": null
		  }
		},
		"bonuses": {
		  "mwak": {
			"attack": null,
			"damage": null
		  },
		  "rwak": {
			"attack": null,
			"damage": null
		  },
		  "msak": {
			"attack": null,
			"damage": null
		  },
		  "rsak": {
			"attack": null,
			"damage": null
		  },
		  "abilities": {
			"check": null,
			"save": null,
			"skill": null
		  },
		  "spell": {
			"dc": null
		  }
		},
		"resources": {
		  "primary": {
			"value": null,
			"max": null,
			"sr": false,
			"lr": false,
			"label": null
		  },
		  "secondary": {
			"value": null,
			"max": null,
			"sr": false,
			"lr": false,
			"label": null
		  },
		  "tertiary": {
			"value": null,
			"max": null,
			"sr": false,
			"lr": false,
			"label": null
		  }
		}
	  },
	  "sort": null,

	  "token": {
		"flags": {},
		"name": null,
		"displayName": null,
		"img": "icons/svg/mystery-man.svg",
		"tint": null,
		"width": 1,
		"height": 1,
		"scale": 1,
		"lockRotation": false,
		"rotation": null,
		"vision": true,
		"dimSight": 60,
		"brightSight": null,
		"dimLight": null,
		"brightLight": null,
		"sightAngle": 360,
		"lightAngle": 360,
		"lightAlpha": 1,
		"actorId": null,
		"actorLink": true,
		"actorData": null,
		"disposition": 1,
		"displayBars": null,
		"bar1": {
		  "attribute": {default: "attributes.hp"}
		},
		"bar2": {
		  "attribute": ""
		},
		"randomImg": false
	},
	"_id": null,
	"img": null
  }

const TemplateClassItemData = { //Foundry uses this for lots of stuff, including Class levels
	 //We add multiple of these to the created Actor
	"name": null,
	"type": "class",
	"img": "systems/dnd5e/icons/skills/blue_13.jpg",
	"data": {
	  "description": {
		"value": "",
		"chat": "",
		"unidentified": ""
	  },
	  "source": "PC Importer",
	  "levels": null,
	  "subclass": null,
	  "hitDice": null,
	  "hitDiceUsed": 0,
	  "skills":{},
	  "spellcasting": null,
	  "damage": {
		"parts": []
	  }
	}
}
const TemplateSpellItemData = {
	"flags": {},
	"name": null,
	"type": "spell",
	"img": null,
	"data": {}
}

const simpleTemplateItemData = {
	"name" : "simple",
	"type" : "loot",
	"data": {
		"description": {
			"value": null,
			"chat": "",
			"unidentified": "",
			"type": "String",
			"label": "Description"
		},
		"source": "PC Importer"
	}
}

const TemplateFeatData = {
	"name" : "simple",
	"type" : "feat",
	"data": {
		"description": {
			"value": null,
			"chat": "",
			"unidentified": "",
			"type": "String",
			"label": "Description"
		},
		"source": "PC Importer"
	}
}

const TemplateItemData = {
	"flags": {},
	"name": null,
	"type": "loot",		//Use this default if we can't find a match on name (until we can do something more accurate)
	"img": null,
	"data": {
		"description": {
			"value": null,
			"chat": "",
			"unidentified": "",
			"type": "String",
			"label": "Description"
		},
		"source": "PC Importer",
		"quantity": 1,
		"weight": 0,
		"price": 0,
		"attuned": false,
		"equipped": false,
		"rarity": "Uncommon",
		"identified": true,
		"capacity": {
			"type": "weight",
			"value": 30,
			"weightless": false
		},
		"activation": {
			"type": "",
			"cost": 0,
			"condition": ""
		},
		"duration": {
			"value": null,
			"units": ""
		},
		"target": {
			"value": null,
			"units": "",
			"type": ""
		},
		"range": {
			"value": null,
			"long": null,
			"units": ""
		},
		"uses": {
			"value": 0,
			"max": 0,
			"per": null,
			"autoDestroy": false,
			"autoUse": false
		},
		"consume": {
			"type": "",
			"target": null,
			"amount": null
		},
		"ability": null,
		"actionType": "",
		"attackBonus": 0,
		"chatFlavor": "",
		"critical": null,
		"damage": {
			"parts": [],
			"versatile": ""
		},
		"formula": "",
		"save": {
			"ability": "",
			"dc": null,
			"scaling": "spell"
		},
		"armor": {
			"value": 14,
			"type": "medium",
			"dex": 2,
			"label": "Armor Value"
		},
		"hp": {
			"value": 0,
			"max": 0,
			"dt": null,
			"conditions": ""
		},
		"speed": {
			"value": null,
			"conditions": ""
		},
		"strength": null,
		"stealth": null,
		"proficient": false,
		"consumableType": "potion",
		"attributes": {
			"spelldc": 10
		},
	},
	"sort": 4000000,
	"labels": {
		"armor": "",
		"activation": "",
		"target": "",
		"range": "",
		"duration": "",
		"recharge": "Recharge [undefined]",
		"damage": "",
		"damageTypes": ""
	},
	"isStack": false,
	"hasUses": false,
	"hasTarget": false,
	"toggleClass": "",
	"toggleTitle": "Not Equipped",
	"totalWeight": 0
}


function defaulted(defaultValue) {return defaultValue;}

function lowercaseArray(mappedArray) {
	mappedArray.forEach((elem,i) => {mappedArray[i] = elem.toLowerCase()});
	return mappedArray;
}
