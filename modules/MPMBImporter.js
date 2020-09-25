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
