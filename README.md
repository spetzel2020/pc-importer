# Quick Encounters

* **Author**: Spetzel#0103
* **Version**: 0.1.1
* **Foundry VTT Compatibility**: 0.6.5-0.7.2
* **System Compatibility (If applicable)**: dnd5e
* **Translation Support**: en


# Description

MPMB-importer imports character sheets from the popular MPMB (More Purple More Better) PDF character sheet into Foundry VTT. Note that MPMB-Importer  imports and matches with built-in 5e Compendiums (currently SRD only), as well as other Compendiums you have created manually or through importers such as D&D Beyond.

# Install

1. Go to the "Add-on Modules" tab in Foundry Setup
2. Click "Install Module" and search for **MPMB Importer** OR paste this link: `https://raw.githubusercontent.com/opus1217/MPMB-importer/v0.1.1/module.json`
3. Open your world and go to Settings>Manage Modules and enable MPMB Importer

# Using MPMB Importer
1. Open your MPMB character sheet in Acrobat Reader DC or similar.
2. Enable the **Show extra features** tool bar, and click the Import/Export button
3. Pick the **Import/Export using files>Export .xfdf file>Export .xfdf file of all fields** option
4. Wait between 15s and several minutes depending on the complexity of your sheet. A new dialog will appear with XFDF output; select all the output in the window, and copy-and-paste into a new file with the XFDF extension
5. From the Foundry Actors tab, create a new Actor with your character name and type "character"
6. Right-click on the new character and pick the Import from MPMB option
7. Browse to the location of the XFDF file created in Step 3 above and select that
8. Click Import
9. MPMB Importer will import recognized content into your character and provide a summary of what content was successfully imported and matched
    - unrecognized content is imported but not matched
