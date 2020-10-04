/*
25-Sep-2020     Created
27-Sep-2020     traverseXML condenses the XML tree down into the values and attributes we need
                v0.3.0 Pull the traversed tree into a simple (field, values) array
                This is actually too destructured; we should walk the tree and create more
                meaningful dynamic structures
30-Sep-2020     v0.5.0 Trim the xmlDoc recursively rather than walking the tree to get the components we care about
                The approaches are equivalent and traverseXML avoids recursion, but for this limited depth it will be Fine
                v0.5.0 Make importedFieldToValuesMap a multi-dimensional array with multiple field values
*/
import {Actor5eFromMPMB} from "./Actor5eFromExt.js";

export var MODULE_NAME;
export var MODULE_VERSION;

function init() {
    MODULE_VERSION = game.i18n.localize("PCI.Version");
    MODULE_NAME =  game.i18n.localize("PCI.id");
    game.settings.register(MODULE_NAME, "PCImporterVersion", {
      name: "PC Importer version",
      hint: "",
      scope: "system",
      config: false,
      default: MODULE_VERSION,
      type: String
    });
}

export class PCImporter {
    constructor() {
        this.importedFieldToValuesMap = new Map();
    }



    static async importFromXFDFDialog() {
      new Dialog({
        title: `Import MPMB XFDF file`,
        content: await renderTemplate("modules/pc-importer/templates/import-data.html"),
        buttons: {
          import: {
            icon: '<i class="fas fa-file-import"></i>',
            label: "Import",
            callback: html => {
              const form = html.find("form")[0];
              if ( !form.data.files.length ) return ui.notifications.error("You did not upload a data file!");
              readTextFromFile(form.data.files[0]).then(xfdf => PCImporter.importFromXML(xfdf));
            }
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel"
          }
        },
        default: "import"
      }, {
        width: 400
      }).render(true);
    }

    static async importFromXML(xfdf) {
        let parser = new DOMParser();
        let xmlDoc = parser.parseFromString(xfdf,"text/xml");
        let pcImporter = new PCImporter();
        const parsedObjectTree = PCImporter.trimXML(xmlDoc);
        if (!parsedObjectTree) {return;}

        //Now convert this simplified version into an even simpler array of (fieldName, value) pairs
        //If the value is nested in several fields, we dot the fields together
        let fieldsSubTree;
        try {
            fieldsSubTree = parsedObjectTree.childNodes[0].childNodes[1];   //the fields structure from xfdf - should probably check
            if (!fieldsSubTree || !fieldsSubTree.childNodes) {return;}
            const childNodes = Object.values(fieldsSubTree.childNodes);

            pcImporter.getNestedFields(childNodes, null);

        } catch {
            return;
        }
        console.log(pcImporter.importedFieldToValuesMap);

        //Populate the Actor5e structure from the importedFieldToValuesMap
        const importedActor = new Actor5eFromMPMB(pcImporter.importedFieldToValuesMap);

        //Now export the importedActor to JSON - this is the skeleton of the Actor, without any classes, items, etc
        importedActor.exportToJSON();
        await importedActor.createFoundryActor();



        return importedActor;
    }

    getNestedFields(childNodes, dottedFieldPrefix) {
        let dottedFields;
        for (const node of childNodes) {
            dottedFields = dottedFieldPrefix ? dottedFieldPrefix : "";
            if (node.nodeName === "field") {
                if (node.attributes && node.attributes.name) {
                    if (dottedFields === "") {
                        dottedFields = node.attributes.name.nodeValue;
                    } else {
                        dottedFields = dottedFields + "." + node.attributes.name.nodeValue;
                    }
                }
                this.getNestedFields(node.childNodes, dottedFields);
            } else if ((node.nodeName === "value") && node.childNodes && node.childNodes[0]) {
                const value = node.childNodes[0].nodeValue;
                this.importedFieldToValuesMap.set(dottedFields, value);
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

    static getValueForFieldName(importedFieldToValuesMap, fieldName) {
        const value = importedFieldToValuesMap.get(fieldName);
        return value;
    }



    //TEMPORARY way of reading a file
    static getSceneControlButtons(buttons) {
        //Hooked on the left-hand set of buttons; add a Create Quick Encounter one
        let notesButton = buttons.find(b => b.name === "token");

        if (notesButton && game.user.isGM) {
            notesButton.tools.push({
                name: "importMPMB",
                title: game.i18n.localize("PCI.BUTTON.ImportXFDF"),
                icon: "fas fa-file-import",
                toggle: false,
                button: true,
                visible: game.user.isGM,
                onClick: () => PCImporter.importFromXFDFDialog()
            });
        }
    }



}


Hooks.on("init", init);
Hooks.on('getSceneControlButtons', PCImporter.getSceneControlButtons);
