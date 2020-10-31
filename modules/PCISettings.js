/*
29-Oct-2020     Created
30-Oct-2020     v0.6.4  Filter the presented compendiums to just those for the Item entity (includes spells, classes etc)
31-Oct-2020     v0.6.5b Add a submenu and a displayed (not editable) field for the list of compendiums
                Remove displayed field (can't keep it in sync in the static config form)
                Create subclasses of the submenu for each different Item type


*/
import {MODULE_NAME, MODULE_VERSION} from "./PCImporter.js";
import {defaultItemTypeToPackNames} from "./Actor5eFromExt.js";




class PCISettings extends FormApplication {
    constructor(itemType, options={}) {
        super(itemType, options);
    }

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: game.i18n.localize("PCI.Compendia.SubMenu.LABEL"),
            id: "pc-importer",
            template: "modules/pc-importer/templates/compendium-select.html",
            top: 300,
            right: 300,
            width: 600,
            height: "auto",
            submitOnClose : true
            /*,
            tabs: [
                {navSelector: ".tabs", contentSelector: ".content", initial: "core"}
            ]
            */
        })
    }

    static init() {
        game.settings.register(MODULE_NAME, "PCImporterVersion", {
            name: "PC Importer version",
            hint: "",
            scope: "system",
            config: false,
            default: MODULE_VERSION,
            type: String
        });
        game.settings.register(MODULE_NAME, "loot", {
            name: "PCI.Compendia.Items.Setting.NAME",
            hint: "PCI.Compendia.Items.Setting.HINT",
            scope: "world",
            config: false,      //Derived value - don't show this
            default: defaultItemTypeToPackNames["loot"],
            type: String
        });
        game.settings.register(MODULE_NAME, "spell", {
            name: "PCI.Compendia.Spells.Setting.NAME",
            hint: "PCI.Compendia.Spells.Setting.HINT",
            scope: "world",
            config: false,      //Derived value - don't show this
            default: defaultItemTypeToPackNames["spell"],
            type: String
        });
        game.settings.register(MODULE_NAME, "feat", {
            name: "PCI.Compendia.Features.Setting.NAME",
            hint: "PCI.Compendia.Features.Setting.HINT",
            scope: "world",
            config: false,      //Derived value - don't show this
            default: defaultItemTypeToPackNames["feat"],
            type: String
        });
        game.settings.register(MODULE_NAME, "class", {
            name: "PCI.Compendia.Classes.Setting.NAME",
            hint: "PCI.Compendia.Classes.Setting.HINT",
            scope: "world",
            config: false,      //Derived value - don't show this
            default: defaultItemTypeToPackNames["class"],
            type: String
        });
        game.settings.registerMenu(MODULE_NAME, "classCompendiumsSubMenu", {
            name: "PCI.Compendia.Classes.Setting.NAME",
            label: "PCI.Compendia.SubMenu.LABEL",
            hint: "PCI.Compendia.CurrentValues.HINT",
            icon: "fas fa-th-list",
            type: PCISettingsClass,
            restricted: true
        });
        game.settings.registerMenu(MODULE_NAME, "featCompendiumsSubMenu", {
            name: "PCI.Compendia.Features.Setting.NAME",
            label: "PCI.Compendia.SubMenu.LABEL",
            hint: "PCI.Compendia.CurrentValues.HINT",
            icon: "fas fa-th-list",
            type: PCISettingsFeature,
            restricted: true
        });
        game.settings.registerMenu(MODULE_NAME, "lootCompendiumsSubMenu", {
            name: "PCI.Compendia.Items.Setting.NAME",
            label: "PCI.Compendia.SubMenu.LABEL",
            hint: "PCI.Compendia.CurrentValues.HINT",
            icon: "fas fa-th-list",
            type: PCISettingsItem,
            restricted: true
        });
        game.settings.registerMenu(MODULE_NAME, "spellCompendiumsSubMenu", {
            name: "PCI.Compendia.Spells.Setting.NAME",
            label: "PCI.Compendia.SubMenu.LABEL",
            hint: "PCI.Compendia.CurrentValues.HINT",
            icon: "fas fa-th-list",
            type: PCISettingsSpell,
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
            default: defaultItemTypeToPackNames[this.object],
            listLength : compendiums.length
        };
    }
    
    async _updateObject(event, formData) {
        //Update the hidden values of compendiums
        const selectedCompendiums = $("#select-compendiums").val();
        const concatCompendiums = selectedCompendiums.join();
        await game.settings.set(MODULE_NAME, this.object, concatCompendiums);
    }

}

class PCISettingsClass extends PCISettings {
    constructor() {
        super("class");
    }
}
class PCISettingsItem extends PCISettings {
    constructor() {
        super("loot");
    }
}
class PCISettingsSpell extends PCISettings {
    constructor() {
        super("spell");
    }
}
class PCISettingsFeature extends PCISettings {
    constructor() {
        super("feat");
    }
}

Hooks.on("init", PCISettings.init);