/*
25-Sep-2020     Created

*/


export const MODULE_NAME = "MPMB-importer";


export class MPMBImporter {
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
        const parsedXFDF = MPMBImporter.traverseXML(xmlDoc);
    }

    static async traverseXML(xmlDoc) {
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
        let parentObject = {};
        let objectTree = {};
        let nodeObjects;
        do {
            switch (direction) {
                case Direction.down:
                    const firstChild = currentNode.firstChild;
                    if (firstChild) {
                        currentNode = firstChild;
                        if (nodeObjects) {
                            parentObject = nodeObjects[nodeObjects.childIndex];
                        } else {
                            parentObject = objectTree;
                        }

                        nodeObjects = {}
                        parentObject.children = nodeObjects;
                        nodeObjects.parent = parentObject;
                        nodeObjects.childIndex = 0;
                        nodeObjects[nodeObjects.childIndex] = {}
                        nodeObjects[nodeObjects.childIndex].name = currentNode.nodeName;

                    } else {
                        //read the terminal value
                        if (nodeObjects && nodeObjects[nodeObjects.childIndex]) {
                            nodeObjects[nodeObjects.childIndex].value =  currentNode.nodeValue;
                        }

                        //and step currentNode to the right
                        direction = Direction.right;
                    }
                    break;
                case Direction.right:
                    const nextNode = currentNode.nextSibling;
                    if (nextNode) {
                        nodeObjects.childIndex++;
                        currentNode = nextNode;
                        nodeObjects[nodeObjects.childIndex] = {}
                        nodeObjects[nodeObjects.childIndex].name = currentNode.nodeName;
                        direction = Direction.down;
                    } else {
                        //back up a level and go right again
                        direction = Direction.up;
                    }
                    break;
                case Direction.up:
                    //The only way this loop ends is if currentNode.parentNode == null;
                    currentNode = currentNode.parentNode;
                    nodeObjects = nodeObjects.parent.children;
                    //Can actually delete the child parent at this point since we will never traverse down here again
                    direction = Direction.right;
                    break;
            }
        } while (currentNode);
        const waitHere = 1;
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
