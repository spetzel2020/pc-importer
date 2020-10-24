# PC Importer

* **Author**: Spetzel#0103
* **Version**: 0.6.1
* **Foundry VTT Compatibility**: 0.6.5-0.7.5
* **System Compatibility (If applicable)**: dnd5e
* **Translation Support**: en


# Description

PC Importer imports Player Character sheets from other systems and methods into Foundry VTT Actors, matching to SRD or other Compendiums you have created manually or through importers such as D&D Beyond.

# Install

1. Go to the "Add-on Modules" tab in Foundry Setup
2. Click "Install Module" and paste this link in the field at the bottom: `https://raw.githubusercontent.com/opus1217/pc-importer/v0.6.1/module.json`
3. Open your world and go to Settings>Manage Modules and enable **PC Importer**

## Using PC Importer with MPMB sheets
1. Open your MPMB character sheet in Acrobat Reader DC or similar.
2. Enable the **Show extra features** tool bar, and click the Import/Export button
3. Pick the **Import/Export using files>Export .xfdf file>Export .xfdf file of all fields** option
4. Wait between 15s and several minutes depending on the complexity of your sheet. A new dialog will appear with XFDF output.
5. Select all the output in the window, and copy-and-paste and save into a new file with the XFDF extension. **WARNING**: The default text selected is not all of the file you need; make sure to `Ctrl-A, Ctrl-C` (or the equivalent on your platform) to get all the text
6. On Foundry, select the Token's control ribbon on the left (the top-left option)
7. In that control ribbon, click the **Import a PC character sheet** control 
8. When the dialog opens, click the **Choose File** button, and browse to the location of the XFDF file created in Step 3 above and select that
9. Click **Import**
10. PC Importer will import recognized content into a newly created Actor (type character) and add unmatched content for the remaining classes, class features, feats, inventory, and spells.
