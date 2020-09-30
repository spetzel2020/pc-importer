/*
25-Sep-2020     Created
27-Sep-2020     traverseXML condenses the XML tree down into the values and attributes we need
                v0.3.0 Pull the traversed tree into a simple (field, values) array
                This is actually too destructured; we should walk the tree and create more
                meaningful dynamic structures
*/
import {Actor5e} from "./Actor5e.js";

export const MODULE_NAME = "MPMB-importer";



export class MPMBImporter {
    constructor(fieldDictionary) {
        this.fieldDictionary = fieldDictionary;
    }


    static init() {
        game.settings.register(MODULE_NAME, "MPMBImporterVersion", {
          name: "MPMB Importer version",
          hint: "",
          scope: "system",
          config: false,
          default: game.i18n.localize("MPMBI.Version"),
          type: String
        });
    }

    static async importFromXFDFDialog() {
      new Dialog({
        title: `Import MPMB XFDF file`,
        content: await renderTemplate("modules/MPMB-importer/templates/import-data.html"),
        buttons: {
          import: {
            icon: '<i class="fas fa-file-import"></i>',
            label: "Import",
            callback: html => {
              const form = html.find("form")[0];
              if ( !form.data.files.length ) return ui.notifications.error("You did not upload a data file!");
              readTextFromFile(form.data.files[0]).then(xfdf => MPMBImporter.importFromXML(xfdf));
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
        const parsedObjectTree = await MPMBImporter.traverseXML(xmlDoc);
        if (!parsedObjectTree) return;

        //Now convert this simplified version into an even simpler array of (fieldName, value) pairs
        let fieldDictionary = new Map();
        let fieldsSubTree;
        try {
            fieldsSubTree = parsedObjectTree[0].childNodes[1];
            if (!fieldsSubTree || !fieldsSubTree.childNodes) {return;}
            const nodeValues = Object.values(fieldsSubTree.childNodes);
            for (const leaf of nodeValues) {
                let name,value = null;
                if (leaf.attributes && leaf.attributes.name) {
                    name = leaf.attributes.name.nodeValue;
                }
                if (leaf.childNodes && leaf.childNodes[0] && leaf.childNodes[0].childNodes && leaf.childNodes[0].childNodes[0]) {
                    value = leaf.childNodes[0].childNodes[0].value;
                }
                if (name) {fieldDictionary.set(name, value);}
            }
        } catch {
            return;
        }

        //Populate the Actor5e structure from the fieldDictionary
        const importedActor = new Actor5e(fieldDictionary);


        //Now export the importedActor to JSON
        importedActor.exportToJSON();


        return importedActor;
    }

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

    static getValueForName(fieldDictionary, fieldName) {
        const value = fieldDictionary.get(fieldName);
        return value;
    }



    //TEMPORARY way of reading a file
    static getSceneControlButtons(buttons) {
        //Hooked on the left-hand set of buttons; add a Create Quick Encounter one
        let notesButton = buttons.find(b => b.name === "token");

        if (notesButton && game.user.isGM) {
            notesButton.tools.push({
                name: "importMPMB",
                title: game.i18n.localize("MPMBI.BUTTON.ImportXFDF"),
                icon: "fas fa-file-import",
                toggle: false,
                button: true,
                visible: game.user.isGM,
                onClick: () => MPMBImporter.importFromXFDFDialog()
            });
        }
    }



}


Hooks.on("init", MPMBImporter.init);
Hooks.on('getSceneControlButtons', MPMBImporter.getSceneControlButtons);
