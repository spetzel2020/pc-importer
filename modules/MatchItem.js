/*
26-Oct-2020     Created - based off https://github.com/syl3r86/favtab (button to add to Favourite tab)


*/                


class MatchItem {


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

    static openMatcher(item) {
        if (!item) {return;}
        //Get all the data packs of this type (for sub-item types, we look just for "item")
        const itemType = ["spell","feat","class","item"].includes(item.type) ? item.type : "item"

        const packsOfType = game.packs.filter(p => p.metadata.type === itemType); 
        let concatenatedPackEntries = [];
        for (const pack of packsOfType) {
            const filteredPackIndex = pack.index.map(i => {return {_id : i._id, name : i.name};});
            concatenatedPackEntries = concatenatedPackEntries.concat(filteredPackIndex);
        }

    }



}


Hooks.on(`renderActorSheet`, (app, html, data) => {
    MatchItem.addMatchControl(app, html, data);
});