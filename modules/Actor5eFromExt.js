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



TO DO:
    - Possibly just skip the JSON import since we create the Actor5e.create()
    - THEN, import the Items consisting of Class(es), Inventory etc, either by referencing SRD or just copying directly
        - suggests a different format for the Item values - not perhaps embedded in the Actor
    - Do a Regex match on the Spells and Items
    - Handle multi-classed characters
*/

import {MODULE_NAME, PCImporter} from "./PCImporter.js";
import Actor5e from "/systems/dnd5e/module/actor/entity.js";    //default export
import Item5e from "/systems/dnd5e/module/item/entity.js";    //default export

const Ability = {
    str : "str",
    dex : "dex",
    con : "con",
    int : "int",
    wis : "wis",
    cha : "cha"
}


export class Actor5eFromExt {
    constructor(pcImporter) {
        this.pcImporter = pcImporter;
        this.actorJSON = null;
        //IMPORTING
    }

    exportToJSON(createFile=true) {
        let data = duplicate(this);
        let allData = null;

        const dataAsJSON = JSON.stringify(data, null, 2);

        // Trigger file save procedure
        if (createFile) {
            const filename = `fvtt-${this.name}.json`;
            saveDataToFile(dataAsJSON, "text/json", filename);
        }
        this.actorJSON = dataAsJSON;
        return dataAsJSON;
    }

    async createFoundryActor() {
        if (!this.actorJSON) {return false;}
        let actorData = duplicate(this);
        delete actorData.actorJSON;
        const options = {temporary: false, renderSheet: false}
        const newActor = await Actor5e.create(actorData, options);
        await newActor.importFromJSON(this.actorJSON);
    }
}

export class Actor5eFromMPMB extends Actor5eFromExt {
    /** @override */
    constructor(pcImporter) {
        super(pcImporter);
        //IMPORTING

        //See https://stackoverflow.com/questions/8085004/iterate-through-nested-javascript-objects
        //Use recursion (only 3 levels deep) to walk through the mapping tree and object in parallel
        this.mapAndIterate(Actor5eToMPMBMapping, this); //create the base Actor

        //Now iterate through available Item-like objects in the input object
        //Classes - do this more functionally and not declaratively

    }

    mapAndIterate(subMappingTree, subObject) {
        for (const entry of Object.entries(subMappingTree)) {
            const entryProperty = entry[0];
            const entryValue = entry[1];
            //If itself an object, then keep on drilling down
            //0.4.2 Have to run it through the mapper because we have both legitimate nested objects
            //and also the special mapping objects like {fieldName: , default: }
            let mappedValue = this.mapToMPMBField(entryValue);
            subObject[entryProperty] = mappedValue;
        }
        return subObject;
    }

    mapToMPMBField(entryValue) {
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
                const mappedArrayValue = this.mapToMPMBField(elem);
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

    async extractClasses() {
        //Unfortunately the base class is not used consistently, but rather the sub-class
        //So instead we pull the class from the 1st Level feature gained (assuming there always is one)
        const levelRegExp = /level ([0-9]+):/;  //extract class level in the form "level nn:"
        const classRegExp = /\(([A-Za-z]+) 1[^0-9]/g;     //extract class name from "(xyz 1"
        const subClassRegExp = /\(([A-Za-z ]+) \d{1,2}/g;  //extract sub-classes from "(xyz nn"
        const mappedValue = this.pcImporter.getValueForFieldName("Class Features");
        //Get first [name][space][number] combination
        const levelMatches = mappedValue.match(levelRegExp);
        let match;
        let classMatches= new Set();
        while (match = classRegExp.exec(mappedValue)) {
            classMatches.add(match[1]);
        }
        let subClassMatches = new Set();
        while (match = subClassRegExp.exec(mappedValue)) {
            //Now remove all matches from classes
            if (!classMatches.has(match[1])) {
                subClassMatches.add(match[1]);
            }
        }

        let itemData = duplicate(TemplateClassItemData);
        itemData.name = classMatches.values().next().value;
        itemData.data.levels = levelMatches[1];
        itemData.data.subclass = subClassMatches.values().next().value;
        const newItem = await Item5e.create(itemData);
        this.items = [newItem];
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
        "MPMB Importer" : {default: "0.4.2"}
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
            "value": "Initiative Bonus",
            "bonus": 0,
            "mod": 0,
            "prof": 0,
            "total": 0
          },
          "spellcasting": "int",
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
          "size": "Size Category",
          "di": {
            "value": [],
            "custom": null
          },
          "dr": {
            "value":  function() {return this.mapArray( ["Resistance Damage Type 1","Resistance Damage Type 2","Resistance Damage Type 3","Resistance Damage Type 4","Resistance Damage Type 5"]);},
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
      "source": "MPMB",
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


function defaulted(defaultValue) {return defaultValue;}

function lowercaseArray(mappedArray) {
    mappedArray.forEach((elem,i) => {mappedArray[i] = elem.toLowerCase()});
    return mappedArray;
}
