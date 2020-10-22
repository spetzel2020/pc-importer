# Changelog

## 0.6.1
- MPMB: Corrently handle multi-classing
- MPMB: Item importing: match if you can, or import the name into the Loot category
        - changed to batch Item update
        - improved matching to find best match by intersecting words

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
