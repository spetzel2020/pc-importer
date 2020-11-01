# Changelog

## 0.6.5
- Settings configuration sub-menu for choosing which Compendia are used
- Right-click option in Spell/Feature/Item matcher in Actor sheet: choose to Add or Replace


## 0.6.3
- Added Quantity and Weight to items
- Item matcher: use (+) icon to pop up comparison sheet; if you pick one it will be added to the Actor sheet
    (will need to add a better workflow)

- Speed up Foundry matching of spells, classes, items

## 0.6.2
 - Change import button to Person+
 - i18n button names on import dialog
 - Add ability to specify additional compendiums or re-order them (although you have to know their filenames)
 - Add race compendium and match Racial Features
 - Show LOADING on Actor name until it's done importing and matching	
- Fix up languages; move those not found in DND5E.languages into custom
- Default added weapons to Proficient

## 0.6.1
- MPMB: Correctly handle multi-classing
- MPMB: Item importing: match if you can, or import the name into the Loot category
        - changed to batch Item update
        - improved matching to find best match by intersecting words
- MPMB: Add Class Features, Feats
-   Tune matching with tradegoods and items so you don't get duplicates;
-   Tighten up matching based on excess words in either target or comparison


## 0.6.0
- Prototype importing from Fantasy Grounds

## 0.5.2
- Prototype Matching in Foundry on Class and Spell names

## 0.5.1
- Extract Spell and Class information as plugs to be later matched in Foundry

## 0.5.0a
- Changed repo and module names to pc-importer with the expectation that we might support importing PCs from other sources,
    e.g. MPMB, Fantasy Grounds, Roll 20, D&D Beyond
    Other importers exist, but this would provide a quick way of bringing over JUST a Player Character

## 0.4.3a
- Fill out inline functions to handle special case conversions: skills, HD, Proficiency, Senses, Personality_Trait, Spell slots
    (however some of these are ignored until we have loaded a class)
- Create Actor and then import JSON


## 0.4.2 (1-Oct-Sep-2020)
- More sophisticated Mapping template which allows for arrays, and uses null as the default
    - uses inline functions to define what should be done after mapping

## 0.4.1 (30-Sep-2020)
- Add more field mappings
- Try deconstructing xmlDoc instead of traversing the XML

## 0.4.0 (29-Sep-2020)
- Basic version of Actor5e.js to create an appropriate structure

## 0.3.0 (27-Sep-2020)
- Fix traversal and create flat (fieldName, value) dictionary

## 0.2.0 (27-Sep-2020)
- Read XML and traverse imperfectly

## 0.1.0 (25-Sep-2020)
- **Created**
-   Open an XFDF file from your local computer
