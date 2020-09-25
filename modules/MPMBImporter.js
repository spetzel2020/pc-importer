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


}


Hooks.on("init", MPMBImporter.init);
