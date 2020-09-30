/*
29-Sep-2020     Created
TODO: Want to record the mapping in a table somewhere so we can lookup from Actor5e to fieldName (and vice versa)
If you created a skeleton with everything except terminal values, could do a lot
*/


import {MODULE_NAME, MPMBImporter} from "./MPMBImporter.js";

const Ability = {
    str : "str",
    dex : "dex",
    con : "con",
    int : "int",
    wis : "wis",
    cha : "cha"
}


export class Actor5e {
    constructor(importedDictionary) {
        this.fieldDictionary = importedDictionary;
        //IMPORTING

        //See https://stackoverflow.com/questions/8085004/iterate-through-nested-javascript-objects
        //Use recursion (only 3 levels deep) to walk through the mapping tree and object in parallel
        this.mapAndIterate(MPMBToActorMapping, this);
        delete this.fieldDictionary;
    }

    mapAndIterate(subMappingTree, subObject) {
        for (const entry of Object.entries(subMappingTree)) {
            const entryProperty = entry[0];
            const entryValue = entry[1];
            //If entryValue is null, then just use as is
            if (entryValue && typeof entryValue === 'object') {
                subObject[entryProperty] = {}
                this.mapAndIterate(entryValue, subObject[entryProperty]);
            } else {
                //Either find a match or keep the mapping string/value
                const value = MPMBImporter.getValueForName(this.fieldDictionary, entryValue);
                subObject[entryProperty] = value ? value : entryValue;
            }
        }
    }

    exportToJSON() {
        let data = duplicate(this);
        let allData = null;

        // Flag some metadata about where the entity was exported some - in case migration is needed later
        //Redudant since we're storing this on every element
        //data.flags["exportSource"] = metadata;
        const dataAsJSON = JSON.stringify(data, null, 2);

        // Trigger file save procedure
        const filename = `fvtt-${this.name}.json`;
        saveDataToFile(dataAsJSON, "text/json", filename);
    }
}

export class AbilityValues {
    constructor() {
        let value;
        let proficient;
    }
}

//Provides the mapping to the field names in the XFDF
const MPMBToActorMapping = {
      "name": "PC Name",
      "type": "character",
      "flags": {
        "exportSource": {
          "world": null,
          "system": "dnd5e",
          "coreVersion": "0.6.6",
          "systemVersion": 0.96
        },
        "dnd5e": {},
        "core": {
          "sheetClass": ""
        }
      },
      "data": {
        "abilities": {
          "str": {
            "value": "Str",
            "proficient":  "Str ST Prof",
            "mod": "Str Mod",
            "prof": null,
            "saveBonus": null,
            "checkBonus": null,
            "save": "Str ST Mod"
          },
          "dex": {
            "value": "Dex",
            "proficient":  "Dex ST Prof",
            "mod": "Dex Mod",
            "prof": null,
            "saveBonus": null,
            "checkBonus": null,
            "save": "Dex ST Mod"
          },
          "con": {
            "value": "Con",
            "proficient":  "Con ST Prof",
            "mod": "Con Mod",
            "prof": null,
            "saveBonus": null,
            "checkBonus": null,
            "save": "Con ST Mod"
          },
          "int": {
            "value": "Int",
            "proficient":  "Int ST Prof",
            "mod": "Int Mod",
            "prof": null,
            "saveBonus": "Int ST Bonus",
            "checkBonus": null,
            "save": "Int ST Mod"
          },
          "wis": {
            "value": "Wis",
            "proficient":  "Wis ST Prof",
            "mod": "Wis Mod",
            "prof": null,
            "saveBonus": null,
            "checkBonus": null,
            "save": "Wis ST Mod"
          },
          "cha": {
            "value": "Cha",
            "proficient":  "Cha ST Prof",
            "mod": "Cha Mod",
            "prof": null,
            "saveBonus": "Cha ST Bonus",
            "checkBonus": null,
            "save": "Cha ST Mod"
          }
        },
        "attributes": {
          "ac": {
            "value": "AC"
          },
          "hp": {
            "value": "HP Current",
            "min": null,
            "max": "HP Max",
            "temp": "HP Temp",
            "tempmax": null
          },
          "init": {
            "value": null,
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null
          },
          "spellcasting": "int",
          "speed": {
            "value": "30 ft",
            "special": null
          },
          "death": {
            "success": null,
            "failure": null
          },
          "encumbrance": {
            "value": null,
            "max": 150,
            "pct": null,
            "encumbered": false
          },
          "exhaustion": null,
          "inspiration": false,
          "hd": null,
          "prof": 1,
          "spelldc": 9
        },
        "details": {
          "biography": {
            "value": null,
            "public": null
          },
          "alignment": null,
          "race": null,
          "background": null,
          "xp": {
            "value": null,
            "min": null,
            "max": null,
            "pct": null
          },
          "trait": null,
          "ideal": null,
          "bond": null,
          "flaw": null,
          "level": null
        },
        "traits": {
          "size": "med",
          "di": {
            "value": [],
            "custom": null
          },
          "dr": {
            "value": [],
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
          "senses": null,
          "languages": {
            "value": [],
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
          "pp": null,
          "gp": null,
          "ep": null,
          "sp": null,
          "cp": null
        },
        "skills": {
          "acr": {
            "value": null,
            "ability": "dex",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "ani": {
            "value": null,
            "ability": "wis",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "arc": {
            "value": null,
            "ability": "int",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "ath": {
            "value": null,
            "ability": "str",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "dec": {
            "value": null,
            "ability": "cha",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "his": {
            "value": null,
            "ability": "int",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "ins": {
            "value": null,
            "ability": "wis",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "itm": {
            "value": null,
            "ability": "cha",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "inv": {
            "value": null,
            "ability": "int",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "med": {
            "value": null,
            "ability": "wis",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "nat": {
            "value": null,
            "ability": "int",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "prc": {
            "value": null,
            "ability": "wis",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "prf": {
            "value": null,
            "ability": "cha",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "per": {
            "value": null,
            "ability": "cha",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "rel": {
            "value": null,
            "ability": "int",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "slt": {
            "value": null,
            "ability": "dex",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "ste": {
            "value": null,
            "ability": "dex",
            "bonus": null,
            "mod": null,
            "prof": null,
            "total": null,
            "passive": null
          },
          "sur": {
            "value": null,
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
            "max": null,
            "override": null
          },
          "spell2": {
            "value": null,
            "max": null,
            "override": null
          },
          "spell3": {
            "value": null,
            "max": null,
            "override": null
          },
          "spell4": {
            "value": null,
            "max": null,
            "override": null
          },
          "spell5": {
            "value": null,
            "max": null,
            "override": null
          },
          "spell6": {
            "value": null,
            "max": null,
            "override": null
          },
          "spell7": {
            "value": null,
            "max": null,
            "override": null
          },
          "spell8": {
            "value": null,
            "max": null,
            "override": null
          },
          "spell9": {
            "value": null,
            "max": null,
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
        "name": "Test Import",
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
          "attribute": "attributes.hp"
        },
        "bar2": {
          "attribute": ""
        },
        "randomImg": false
      },
      "items": [],
      "_id": null,
      "img": null
}
