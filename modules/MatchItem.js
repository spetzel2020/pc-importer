/*
26-Oct-2020     Created - based off https://github.com/syl3r86/favtab (button to add to Favourite tab)
27-Oct-2020     v0.6.3b: In the ready Hook preload the item pack indexes by different categories, so depending on tab we ony bring one up
                May have to load the packs themselves for searching by more than name
                v0.6.3c: MatchItem dialog to allow searching, filtering, and selecting - skeleton
28-Oct-2020     v0.6.3d: Prefill the search box
                Fetch the referenced item from the pack  and create it in the Actor        
31-Oct-2020     v0.6.5f: Right-click context menu let syou replace or add the found item                      

*/         
import {Actor5eFromExt} from "./Actor5eFromExt.js";

let itemPackIndexesByType = {};
const titleForItemType = {
    "loot": "PCI.SelectList.Item.TITLE",
    "spell" : "PCI.SelectList.Spell.TITLE",
    "feature": "PCI.SelectList.Feature.TITLE"
}

class MatchItem extends Compendium {
    constructor(metadata, actor,  options) {
        if (metadata) {metadata.entity =  "Item";}
        super(metadata, options);
        //data is stored in this.metadata
        this.metadata.actor = actor;    //the owner actor
    }

    /* -------------------------------------------- */

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            template: "modules/pc-importer/templates/item-picker.html",
            id: "PIContainers",
            dragDrop: []
        });
    }

    /* -------------------------------------------- */

    /** @override */
    get title() {
        const titleKey = titleForItemType[this.metadata.item.type];
        return game.i18n.localize(titleKey) || "Select a matching Item";
    }

    /** @override */
    async getData() {
        const words = this.metadata.item.name.split(" ");
        let defaultSearch = "";
        words.forEach((w,i) => {
            defaultSearch += (i===0) ? w : "|"+w;
        });
        return {
            items: this.metadata.packEntries,
            itemTypeLocalized: this.metadata.item.type,
            defaultSearch: defaultSearch
        };
    }

    /** @override */
    //Normal search escapes everything - we want to use a more sophisticated search that allows ORs
    _onSearchFilter(event, query, html) {
        const rgx = new RegExp(query, "i"); //Remove RefExp.escape so we can include | (OR) symbol
        for (let li of html.children) {
            const name = li.querySelector(".entry-name").textContent;
            li.style.display = rgx.test(name) ? "flex" : "none";
        }
    }

    /** @override */
    async _onEntry(entryId) {
        //Because we maybe smushed together multiple packs, look it up in the relevant index
        const packEntry = this.metadata.packEntries.find(p => p._id === entryId);
        if (!packEntry || !packEntry.pack) {return;}

        const entity = await packEntry.pack.getEntity(entryId);
        if (!entity) {return;}

        let sheet = entity.sheet;
        sheet = Object.values(ui.windows).find(app => app.id === sheet.id) ?? sheet;
        if (sheet._minimized) return sheet.maximize();
        sheet.render(true);
    }

    /** Render the ContextMenu which applies to each compendium entry
     * @private
     */
    _contextMenu(html) {
        const cm = new ContextMenu(html, ".directory-item", [
            {
                name: "PCI.ActorSheet.MatchDialog.ADD",
                icon: '<i class="fas fa-download"></i>',
                callback: li => {
                    const entryId = li.attr('data-entry-id');
                    this.importOwnedItem(entryId);
  
                }
            },
            {
                name: "PCI.ActorSheet.MatchDialog.REPLACE",
                icon: '<i class="fas fa-trash"></i>',
                callback: li => {
                    let entryId = li.attr('data-entry-id');
                    this.importOwnedItem(entryId).then(() => {
                        //delete the previous one (saved in this.metadata.item)
                        const actor = this.metadata.actor;
                        if (actor) {actor.deleteOwnedItem(this.metadata.item._id)}
                    });
                }
            }
        ]);
    }

    async importOwnedItem(entryId) {
        //Because we maybe smushed together multiple packs, look it up in the relevant index
        const packEntry = this.metadata.packEntries.find(p => p._id === entryId);
        if (!packEntry || !packEntry.pack) { return; }
        const entity = await packEntry.pack.getEntity(entryId);
        const actor = this.metadata.actor;

        if (actor && entity) {
            const newItemData = duplicate(entity.data);
            actor.createOwnedItem(newItemData);
        }
    }
    

    //Add the magnifying glass icon to all icon instances
    static addMatchControl(app, html, data) {
        const actor = app.entity;
        for (const item of data.actor.items) {
            if (app.options.editable) {
                let matchButton = $(`<a class="item-control item-match" data-match=true title="${game.i18n.localize("PCI.ActorSheet.Match.HOVER")}"><i class="fas fa-search-plus"></i></a>`);
                matchButton.click(ev => {
                    MatchItem.openMatcher(item, actor);
//FIXME : Would like to bold or otherwise indicate which one we picked
                });
                html.find(`.item[data-item-id="${item._id}"]`).find('.item-controls').prepend(matchButton);
            }
        }

        // Change the css in the sheet (whosever it is) to accommodate the match button
        if (app.options.editable) {
            html.find('.spellbook .item-controls').css('flex', '0 0 110px');
            html.find('.inventory .item-controls').css('flex', '0 0 110px');
            html.find('.features .item-controls').css('flex', '0 0 100px');
        }
    }

    static async openMatcher(item, actor) {
        if (!item || !actor) {return;}
        //Get all the data packs of this type (for sub-item types, we look just for "loot")
        const itemType = ["spell","feat","class","loot"].includes(item.type) ? item.type : "loot"

        //We got all the then-defined item pack indexes in the ready step
        //v0.6.5: and they are rebuilt if we change the Compendiums used
//FIXME: Should build this list once for each tab so that we don't need to redo
        let concatenatedPackEntries = [];
        for (const entry of itemPackIndexesByType[itemType]) {
            const packIndex = entry.packIndex;
            const pack = entry.pack;
            const filteredPackIndex = packIndex.map(i => {return {pack: pack, _id : i._id, name : i.name, img: i.img};});
            concatenatedPackEntries = concatenatedPackEntries.concat(filteredPackIndex);
        }
        //Now create the matcher dialog
        const matcherDialog = new MatchItem({item: item, packEntries: concatenatedPackEntries}, actor);
        matcherDialog.render(true);

    }
}

export async function buildItemPackIndexesByType() {
    //Get the relevant mappings (spell, class, etc.)
    const itemTypeToPackNames = Actor5eFromExt.getItemTypePackNames();

    //Preload the Item pack indexes
    itemPackIndexesByType = {};
    for (const [itemType, packNames] of Object.entries(itemTypeToPackNames)) {
        itemPackIndexesByType[itemType] = [];
        for (const packName of packNames) {
            const pack = game.packs.get(packName);
            if (pack) {
                pack.getIndex().then(packIndex => {
                    if (packIndex) { itemPackIndexesByType[itemType].push({packIndex: packIndex, pack: pack}); }
                });
            }
        }//end for packName
    }
}

Hooks.on("ready", buildItemPackIndexesByType);

Hooks.on(`renderActorSheet`, (app, html, data) => {
    MatchItem.addMatchControl(app, html, data);
});