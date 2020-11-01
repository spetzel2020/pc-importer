# PC Importer

* **Author**: Spetzel#0103
* **Version**: 0.6.6
* **Foundry VTT Compatibility**: 0.6.5-0.7.5
* **System Compatibility (If applicable)**: dnd5e
* **Translation Support**: en


# Description

PC Importer imports Player Character sheets from other systems and methods into Foundry VTT Actors, matching to SRD or other Compendiums you have created manually or through importers such as D&D Beyond.

# Install

1. Go to the "Add-on Modules" tab in Foundry Setup
2. Click "Install Module" and paste this link in the field at the bottom: `https://raw.githubusercontent.com/opus1217/pc-importer/v0.6.6/module.json`
3. Open your world and go to Settings>Manage Modules and enable **PC Importer**

## Using PC Importer with MPMB sheets
### With your MPMB character sheet
1. Open your MPMB character sheet in Acrobat Reader DC or similar.
2. Enable the **Show extra features** tool bar, and click the Import/Export button
3. Pick the **Import/Export using files>Export .xfdf file>Export .xfdf file of all fields** option
4. Wait between 15s and several minutes depending on the complexity of your sheet. A new dialog will appear with XFDF output.
5. Select all the output in the window, and copy-and-paste and save into a new file with the XFDF extension. **WARNING**: The default text selected is not all of the file you need; make sure to `Ctrl-A, Ctrl-C` (or the equivalent on your platform) to get all the text
### On Foundry
6. On Foundry, select the Basic Controls on the left (the top-left "person" option, under the d20-anvil icon)
7. In that Basic Controls palette, click the **Import a PC character sheet** control (the person-plus option)
![The Import a PC option](https://github.com/opus1217/pc-importer/blob/master/img/import-pc-control.PNG?raw=true)
8. When the dialog opens, click the **Choose File** button, and browse to the location of the XFDF file created in Step 3 above and select that
9. Click **Import**
10. PC Importer will import recognized content into a newly created Actor (type character) and add unmatched content for the remaining classes, class features, feats, inventory, and spells. The name will show "...LOADING" after the Actor has been created, but while remaining content is being processed.
11. Open the character sheet for your new Actor; click the magnifying-glass icon to show matching options - you can right-click a match to either Add or Replace it in the sheet

## Contribution
*Coming soon!*

## License
**PC Importer for Foundry** by Jeffrey Pugh is licensed under a [GNU General Public License v3.0](https://github.com/opus1217/pc-importer/edit/master/LICENSE.md)

Portions incorporated from [Favourites Tab](https://github.com/syl3r86/favtab/blob/master/README.md)

This work is licensed under Foundry Virtual Tabletop [EULA - Limited License Agreement for module development v 0.1.6](http://foundryvtt.com/pages/license.html).
