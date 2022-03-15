/*
25-Sep-2020     Created
27-Sep-2020     traverseXML condenses the XML tree down into the values and attributes we need
                v0.3.0 Pull the traversed tree into a simple (field, values) array
                This is actually too destructured; we should walk the tree and create more
                meaningful dynamic structures
30-Sep-2020     v0.5.0 Trim the xmlDoc recursively rather than walking the tree to get the components we care about
                The approaches are equivalent and traverseXML avoids recursion, but for this limited depth it will be Fine
5-Oct-2020      Use pcImporter instance variable to hold the fieldToValuesDictionary
6-Oct-2020      v0.5.1: Add getValuesForPattern for fuzzy match (e.g. for spells)
7-Oct-2020      v0.5.2: Prototype matching in Foundry with Spells, Classes, and Features
8-Oct-2020      v0.6.0: Add basic Fantasy Grounds import from XML
20-Oct-2020     v0.6.1: Add basic item importing
21-Oct-2020     v0.6.1c: Also remove JSON export for now
                v0.6.1d: importFromFileDialog: Change to show creating new Actor using side button
24-Oct-2020     v0.6.2: i18n buttons on import dialog  
25-Oct-2020     v0.6.2: Change import button to Person+
                Add Settings for default Compendiums to search for classes etc.
26-Oct-2020     v0.6.3: getEntriesForPattern() returns both key and value   
27-Oct-2020     v0.6.3b: Removed "race" setting since Racial Features are actually in with Class Features(?)          
31-Oct-2020     v0.6.6b: Move settings config in init to PCISettings.js  


*/
import {Actor5eFromMPMB,Actor5eFromFG} from "./Actor5eFromExt.js";

export var MODULE_NAME="pc-importer";
export var MODULE_VERSION="0.8.1";

const ImportType = {
    fantasyGrounds : "Fantasy Grounds",
    MPMB : "MPMB",
    roll20 : "Roll20"
}


export class PCImporter {
    constructor() {
        this.importedFieldToValuesMap = new Map();
        this.importType = null;
    }

    static async importFromFileDialog() {
//FIXME: for now this is started from the button which alway creates a new Actor        
        const dialogContent = game.i18n.localize("PCI.ImportDialog.CONTENT") + game.i18n.localize("PCI.ImportDialog.Create.CONTENT");
        new Dialog({
            title: game.i18n.localize("PCI.ImportDialog.TITLE"),
            content: await renderTemplate("modules/pc-importer/templates/import-data.html",{dialogContent: dialogContent}),
            buttons: {
            import: {
                icon: '<i class="fas fa-file-import"></i>',
                    label: game.i18n.localize("PCI.ImportDialog.Import.BUTTON"),
                callback: html => {
                const form = html.find("form")[0];
                if ( !form.data.files.length ) return ui.notifications.error("You did not upload a data file!");
                readTextFromFile(form.data.files[0]).then(fileContent => PCImporter.parseContent(fileContent));
                }
            },
            no: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("PCI.ImportDialog.Cancel.BUTTON")
            }
            },
            default: "import"
        }, {
            width: 400
        }).render(true);
    }

    static async parseContent(fileContent) {
        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(fileContent,"text/xml");
        let pcImporter = new PCImporter();
        const parsedObjectTree = PCImporter.trimXML(xmlDoc);
        if (!parsedObjectTree || !parsedObjectTree.childNodes) {return;}

        //0.6: Try to automatically categorize the source of this
        try {
            if (parsedObjectTree.childNodes[0].attributes[1].nodeValue === "8|CoreRPG:4") {
                pcImporter.importType = ImportType.fantasyGrounds;
            } else {
//FIXME: Replace with specific test based on xfdf tag
                pcImporter.importType = ImportType.MPMB;
            }
        } catch {
            //Couldn't recognize or retrieve flags indicating any known system
        }


        //Now convert this simplified version into an even simpler array of (fieldName, value) pairs
        //If the value is nested in several fields, we dot the fields together
        let subTree;
        try {
            subTree = parsedObjectTree.childNodes[0].childNodes[1];
            if (!subTree || !subTree.childNodes) {return;}
            const childNodes = Object.values(subTree.childNodes);

            pcImporter.getNestedFields(childNodes, null);

        } catch {
            return;
        }
        console.log(pcImporter.importedFieldToValuesMap);


        let importedActor;
        if (pcImporter.importType === ImportType.fantasyGrounds) {
            importedActor = await Actor5eFromFG.create(pcImporter);
        } else if (pcImporter.importType === ImportType.MPMB) {
            importedActor = await Actor5eFromMPMB.create(pcImporter);
        }

        // Uses the actorData to create the Foundry Actor and then do the matching
        //Now match with Compendiums to get Classes, Class Features, Spells etc.
        //We want that to be non-specific to the specific import (so Actor5eFromExt, rather than a subclass )
        await importedActor.createFoundryActor();

        //Now export the importedActor to JSON for posterity
        //Shouldn't be input method-specific
        //v0.6.1c: Skip exporting for now since we are creating the Actor
        //importedActor.exportToJSON();

        return importedActor;
    }

    getNestedFields(childNodes, dottedFieldPrefix) {
        let dottedFields;
        for (const node of childNodes) {
            dottedFields = dottedFieldPrefix ? dottedFieldPrefix : "";

            if (this.importType === ImportType.MPMB) {
                if ((node.nodeName === "value") && node.childNodes && node.childNodes[0]) {
                   const value = node.childNodes[0].nodeValue;
                   this.importedFieldToValuesMap.set(dottedFields, value);
               } else if (node.nodeName === "field") {
                   //Field names are in the attributes of a node named "field"
                    if (node.attributes && node.attributes.name) {
                        if (dottedFields === "") {
                            dottedFields = node.attributes.name.nodeValue;
                        } else {
                            dottedFields = dottedFields + "." + node.attributes.name.nodeValue;
                        }
                    }
                    this.getNestedFields(node.childNodes, dottedFields);
                }
            } else if (this.importType === ImportType.fantasyGrounds) {
                //Field names here are actual nodeNames, and values are their nested value under #text
                if (node.nodeName === "#text") {
                    const value = node.nodeValue.trim();
                    if (value !== "") {this.importedFieldToValuesMap.set(dottedFields, value);}
               } else {
                   //Field names are the nodeName
                    if (dottedFields === "") {
                        dottedFields = node.nodeName;
                    } else {
                        dottedFields = dottedFields + "." + node.nodeName;
                    }
                    this.getNestedFields(node.childNodes, dottedFields);
                }
            }



        }
    }

    static trimXML(xml) {
        if (!xml) {return;}
        let trimmedXML = {
            nodeName : xml.nodeName,
            nodeValue : xml.nodeValue,
            attributes: xml.attributes,
            childNodes: xml.childNodes
        }
        Object.keys(trimmedXML).forEach(key => {
            if (trimmedXML[key] === null) {delete trimmedXML[key];}
        });

        let newChildNodes = [];
        trimmedXML.childNodes.forEach((node, i) => {
            newChildNodes.push(PCImporter.trimXML(node));
        });
        trimmedXML.childNodes = newChildNodes;
        return trimmedXML;
    }

    //DEPRECATED - won't work (changed property names) and use trimXML instead (although it's recursive)
    static async traverseXML(xmlDoc) {
        //One way of pulling the essential nodeName, attributes, values from the XFDF
        const Direction = {
            right: "right",
            down: "down",
            up: "up"
        }

        if (!xmlDoc) {return;}
        //Traverse the xmlDoc by childNodes - follow each path until we get to a value
        //Note that the parsed xmlDoc contains many shortcuts for traversing the XML
        let currentNode = xmlDoc;
        let direction = Direction.down;
        let objectTree;
        let parentObject = {};
        let childNodes;
        do {
            switch (direction) {
                case Direction.down:
                    const firstChild = currentNode.firstChild;
                    if (firstChild) {
                        currentNode = firstChild;

                        const newNodes = {}
                        if (childNodes) {
                            parentObject = childNodes;
                            childNodes[childNodes.childIndex].childNodes = newNodes;
                        }

                        childNodes = newNodes;
                        childNodes.parent = parentObject;
                        childNodes.childIndex = 0;
                        childNodes[childNodes.childIndex] = {}
                        childNodes[childNodes.childIndex].nodeName = currentNode.nodeName;
                        if (currentNode.attributes) {childNodes[childNodes.childIndex].attributes = currentNode.attributes;}
                    } else {
                        //read the terminal value
                        if (childNodes && childNodes[childNodes.childIndex]) {
                            childNodes[childNodes.childIndex].value =  currentNode.nodeValue;
                        }

                        //and step currentNode to the right
                        direction = Direction.right;
                    }
                    break;
                case Direction.right:
                    const nextNode = currentNode.nextSibling;
                    if (nextNode) {
                        childNodes.childIndex++;
                        currentNode = nextNode;
                        childNodes[childNodes.childIndex] = {}
                        childNodes[childNodes.childIndex].nodeName = currentNode.nodeName;
                        if (currentNode.attributes) {childNodes[childNodes.childIndex].attributes = currentNode.attributes;}
                        direction = Direction.down;
                    } else {
                        //back up a level and go right again
                        direction = Direction.up;
                    }
                    break;
                case Direction.up:
                    //The only way this loop ends is if currentNode.parentNode == null;
                    currentNode = currentNode.parentNode;
                    if (currentNode) {objectTree = childNodes;}
                    childNodes = childNodes.parent;

                    //Can actually delete the child parent at this point since we will never traverse down here again
                    direction = Direction.right;
                    break;
            }
        } while (currentNode);
        return objectTree;
    }

    getValueForFieldName(fieldName) {
        const value = this.importedFieldToValuesMap.get(fieldName);
        return value;
    }
    getValuesForPattern(fieldNamePattern) {
        let iterator = this.importedFieldToValuesMap.entries();
        let values = [];
        for (let nextEntry=iterator.next(); !nextEntry.done; nextEntry=iterator.next()) {
            const [key,value] = nextEntry.value;
            if (key.match(fieldNamePattern)) {values.push(value);}
        }
        return values;
    }
    getEntriesForPattern(fieldNamePattern) {
        //Returns both the key and the value so we can match Gear Name, Weight, Amount (for example)
        let iterator = this.importedFieldToValuesMap.entries();
        let entries = new Map();
        for (let nextEntry = iterator.next(); !nextEntry.done; nextEntry = iterator.next()) {
            const [key, value] = nextEntry.value;
            if (key.match(fieldNamePattern)) { entries.set(key, value); }
        }
        return entries;
    }



    //TEMPORARY way of reading a file
    static getSceneControlButtons(buttons) {
        //Hooked on the left-hand set of buttons; add a Create Quick Encounter one
        let notesButton = buttons.find(b => b.name === "token");

        if (notesButton && game.user.isGM) {
            notesButton.tools.push({
                name: "importPC",
                title: "PCI.Import.BUTTON",
                icon: "fas fa-user-plus",
                toggle: false,
                button: true,
                visible: game.user.isGM,
                onClick: () => PCImporter.importFromFileDialog()
            });
        }
    }



}


Hooks.on('getSceneControlButtons', PCImporter.getSceneControlButtons);
