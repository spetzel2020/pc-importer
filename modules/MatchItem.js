/*
26-Oct-2020     Created - based off https://github.com/syl3r86/favtab (button to add to Favourite tab)
27-Oct-2020     v0.6.3b: In the ready Hook preload the item pack indexes by different categories, so depending on tab we ony bring one up
                May have to load the packs themselves for searching by more than name
                v0.6.3c: MatchItem dialog to allow searching, filtering, and selecting - skeleton

*/         
import {Actor5eFromExt} from "./Actor5eFromExt.js";

let itemPackIndexesByType = {};

class MatchItem extends Application {
    constructor(data, options) {
        super(options);
        this.data = data;
    }

    /* -------------------------------------------- */

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "modules/pc-importer/templates/item-picker.html",
            id: "PIContainers",
            classes: ["item-list","group-legend"],
            width: 400,
            jQuery: true
        });
    }

    /* -------------------------------------------- */

    /** @override */
    get title() {
        return this.data.title || "Items";
    }


    async getData() {
        return {
            items: this.data.packEntries,
            itemTypeLocalized: this.data.item.type
        };
    }



    //Add the magnifying glass icon to all icon instances
    static addMatchControl(app, html, data) {
        for (const item of data.actor.items) {
            if (app.options.editable) {
                let matchButton = $(`<a class="item-control item-match" data-match=true title="match with compendium"}"><i class="fas fa-search-plus"></i></a>`);
                matchButton.click(ev => {
                    MatchItem.openMatcher(item);
                });
                html.find(`.item[data-item-id="${item._id}"]`).find('.item-controls').prepend(matchButton);
            }
        }

        // Change the css in the sheet (whosever it is) to accommodate the match button
        if (app.options.editable) {
            html.find('.spellbook .item-controls').css('flex', '0 0 88px');
            html.find('.inventory .item-controls').css('flex', '0 0 88px');
            html.find('.features .item-controls').css('flex', '0 0 66px');
        }
    }

    static async openMatcher(item) {
        if (!item) {return;}
        //Get all the data packs of this type (for sub-item types, we look just for "loot")
        const itemType = ["spell","feat","class","loot"].includes(item.type) ? item.type : "loot"

        //We got all the then-defined item pack indexes in the ready step
//FIXME: Should check if there are any new ones and get them now
        let concatenatedPackEntries = [];
        for (const packIndex of itemPackIndexesByType[itemType]) {
            const filteredPackIndex = packIndex.map(i => {return {_id : i._id, name : i.name};});
            concatenatedPackEntries = concatenatedPackEntries.concat(filteredPackIndex);
        }
        //Now create the matcher dialog
        const matcherDialog = new MatchItem({item: item, packEntries: concatenatedPackEntries});
        matcherDialog.render(true);

    }




}

Hooks.on("ready", async () => {
    //Get the relevant mappings (spell, class, etc.)
    const itemTypeToPackNames = Actor5eFromExt.getItemTypePackNames();

    //Preload the Item pack indexes
    const itemPacks = game.packs.filter(p => p.metadata.entity === "Item");
    itemPackIndexesByType = {};
    for (const [itemType,packNames] of Object.entries(itemTypeToPackNames)) {
        itemPackIndexesByType[itemType] = [];
        for (const packName of packNames) {
            const pack = game.packs.get(packName);
            if (pack) {
                pack.getIndex().then(packIndex => {
                    if (packIndex) { itemPackIndexesByType[itemType].push(packIndex); }
                });
            }
        }//end for packName
    }
});

Hooks.on(`renderActorSheet`, (app, html, data) => {
    MatchItem.addMatchControl(app, html, data);
});