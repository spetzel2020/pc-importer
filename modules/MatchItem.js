/*
26-Oct-2020     Created - based off https://github.com/syl3r86/favtab (button to add to Favourite tab)
27-Oct-2020     v0.6.3b: In the ready Hook preload the item pack indexes by different categories, so depending on tab we ony bring one up
                May have to load the packs themselves for searching by more than name
                v0.6.3c: MatchItem dialog to allow searching, filtering, and selecting - skeleton
28-Oct-2020     v0.6.3d: Prefill the search box
                Fetch the referenced item from the pack  and create it in the Actor        
31-Oct-2020     v0.6.5f: Right-click context menu let syou replace or add the found item      
2-Nov-2020      v0.6.9: getData(): Return a select-list with the default item (that is being shown) picked
14-Mar-2020     v0.8.1a: addMatchControl(): app.entity --> app.document
16-Mar-2022     v0.8.1b: Convert to Foundry v9 functions and css terminology
                Note this creates a concatenated Compendium on the fly, so can't use standard base class calls which reference the database
                Set metadata correctly in creation of CompendiumCollection
                getData(): Pass only the compendium index
                onEntry()--> onClickEntry()
                openMatcher(): Now creates a CompendiumCollection with an embedded concatenated pack index augmented with the pack object
*/
import {Actor5eFromExt} from "./Actor5eFromExt.js";

let itemPackIndexesByType = {};
const titleForItemType = {
    "loot": "PCI.SelectList.Item.TITLE",
    "spell": "PCI.SelectList.Spell.TITLE",
    "feature": "PCI.SelectList.Feature.TITLE"
}

class MatchItem extends Compendium {
    constructor(collection, actor, options) {
        super(collection, options);
        //data is stored in this.collection
        this.collection.actor = actor;    //the owner actor
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
        const titleKey = titleForItemType[this.metadata.type];
        return game.i18n.localize(titleKey) || "Select a matching Item";
    }

    /** @override */
    async getData() {
        //Different list types
        let itemTypeLocalized = this.metadata.itemToMatch.type;
        let listTypes = [
            {type: "loot", isSelected: false},
            {type: "spell", isSelected: false},
            {type: "feature", isSelected: false}
        ]
        listTypes.forEach((element, i) => {
            listTypes[i].isSelected = (element.type === itemTypeLocalized)
        });

        //Suggested search terms
        const words = this.metadata.itemToMatch.name.split(" ");
        let defaultSearch = "";
        words.forEach((w, i) => {
            defaultSearch += (i === 0) ? w : "|" + w;
        });
        //0.8.1b: Model this more after v9 Compendium.getData()
        return {
            collection: this.collection,
            index: this.collection.index,
            itemTypeLocalized: itemTypeLocalized,
            defaultSearch: defaultSearch,
            listTypes: listTypes
        };
    }

    /** @override */
    //Normal search escapes everything - we want to use a more sophisticated search that allows ORs
    _onSearchFilter(event, query, rgx, html) {
        const newRgx = new RegExp(query, "i"); //Remove RegExp.escape so we can include | (OR) symbol
        for (let li of html.children) {
            const name = li.querySelector(".entry-name").textContent;
            li.style.display = newRgx.test(name) ? "flex" : "none";
        }
    }

    /** @override */
    async _onClickEntry(event) {
        //Because we maybe smushed together multiple packs, look it up in the relevant index
        const li = event.currentTarget.parentElement;
        const packEntry = this.collection.index.find(p => p._id === li.dataset.documentId);
        if (!packEntry || !packEntry.pack) { return; }

        const document = await packEntry.pack.getDocument(li.dataset.documentId);
        if (!document) { return; }

        let sheet = document.sheet;
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
                    const entryId = li.attr('data-document-id');
                    this.importEmbeddedItem(entryId);

                }
            },
            {
                name: "PCI.ActorSheet.MatchDialog.REPLACE",
                icon: '<i class="fas fa-trash"></i>',
                callback: li => {
                    let entryId = li.attr('data-document-id');
                    this.importEmbeddedItem(entryId).then(() => {
                        //delete the previous one (saved in this.collection.item)
                        const actor = this.collection.actor;
                        if (actor) { Item.deleteDocuments([this.metadata.itemToMatch._id], {parent : actor}); }
                    });
                }
            }
        ]);
    }

    async importEmbeddedItem(entryId) {
        //Because we maybe smushed together multiple packs, look it up in the relevant index
        const packEntry = this.collection.index.find(p => p._id === entryId);
        if (!packEntry || !packEntry.pack) { return; }
        const newItem = await packEntry.pack.getDocument(entryId);
        const actor = this.collection.actor;

        if (actor && newItem) {
            actor.addEmbeddedItems([newItem], false);
        }
    }


    //Add the magnifying glass icon to all icon instances
    static addMatchControl(app, html, data) {
        const actor = app.document;
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

    static async openMatcher(itemToMatch, actor) {
        if (!itemToMatch || !actor) { return; }
        //Get all the data packs of this type (for sub-item types, we look just for "loot")
        const itemType = ["spell", "feat", "class", "loot"].includes(itemToMatch.type) ? itemToMatch.type : "loot"

        //We got all the then-defined item pack indexes in the ready step
        //v0.6.5: and they are rebuilt if we change the Compendiums used
        //FIXME: Should build this list once for each tab so that we don't need to redo
        let collectionIndex = [];   //specifically for when you click on an item (for _onClickEntry)
        for (const entry of itemPackIndexesByType[itemType]) {
            const packIndex = entry.packIndex;
            const pack = entry.pack;
            //v0.8.1b: Hack to include the pack name with the elements so we can look up in the base pack (because these values are all concatenated)
            const augmentedPackIndex = packIndex.map(i => { return {pack: pack, _id: i._id, name: i.name, img: i.img}; });
            collectionIndex = collectionIndex.concat(...augmentedPackIndex);
        }
        //Now create the matcher dialog
        const metadata = {
            type : "Item",
            itemToMatch: itemToMatch, 
            index: collectionIndex  //if we set this, then the CompendiumCollection constructor will build an {_id, i} index
        };
        const compendiumCollection = new CompendiumCollection(metadata);
        const matcherDialog = new MatchItem(compendiumCollection, actor);
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