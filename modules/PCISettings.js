/*
29-Oct-2020     Created
30-Oct-2020     v0.6.4  Filter the presented compendiums to just those for the Item entity (includes spells, classes etc)


*/
import {MODULE_NAME} from "./PCImporter.js";

class PCISettings extends FormApplication {
    constructor(itemType, options) {
//FIXME: itemType (e.g. spell, class) needs to be passed somehow
        const tempItemType = "item";
        super(tempItemType, options);
    }

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: game.i18n.localize("PCI.Compendia.SubMenu.NAME"),
            id: "pc-importer",
            template: "modules/pc-importer/templates/compendium-select.html",
            top: 300,
            right: 300,
            width: 600,
            height: "auto"
            /*,
            tabs: [
                {navSelector: ".tabs", contentSelector: ".content", initial: "core"}
            ]
            */
        })
    }

    static init() {
        game.settings.registerMenu(MODULE_NAME, "Compendiums", {
            name: "PCI.Compendia.SubMenu.NAME",
            label: "PCI.Compendia.SubMenu.LABEL",
            hint: "PCI.Compendia.SubMenu.HINT",
            icon: "fas fa-th-list",
            type: PCISettings,
            restricted: true
            });
    }

    /** @override */
    async getData() {
        const entity = "Item";
        //Convert game.packs from Map to Array
        const packsForEntity = game.packs.filter(v => v.metadata.entity === entity);
        const compendiums = packsForEntity;
        return {
            compendiums: compendiums,
            itemType: this.object,
            listLength : compendiums.length
        };
    }
    
}

Hooks.on("init", PCISettings.init);