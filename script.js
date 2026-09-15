async function fixPack() {

    const fileInput = document.getElementById("file");
    const status = document.getElementById("status");
    const button = document.getElementById("fixButton");

    if (!fileInput.files.length) {
        status.textContent = "Please select a .mcpack, .mcaddon, or .zip file.";
        return;
    }

    const file = fileInput.files[0];

    try {

        button.disabled = true;
        status.textContent = "Reading pack...";

        const originalName = file.name;

        const zip = await JSZip.loadAsync(file);

        let manifestCount = 0;
        let changedCount = 0;
        let packFiles = [];

        /*
         * Recursively process an archive.
         *
         * This handles:
         *
         * ZIP
         *  ├── RP.mcpack
         *  └── BP.mcpack
         *
         * and:
         *
         * ZIP
         *  └── addon.mcaddon
         *       ├── RP.mcpack
         *       └── BP.mcpack
         */

        async function processArchive(archive) {

            const entries = [];

            archive.forEach((path, entry) => {
                if (!entry.dir) {
                    entries.push({
                        path: path,
                        entry: entry
                    });
                }
            });

            for (const item of entries) {

                const path = item.path;
                const entry = item.entry;

                const lowerPath = path.toLowerCase();

                /*
                 * Direct manifest.json
                 */

                if (lowerPath.endsWith("manifest.json")) {

                    try {

                        const text = await entry.async("text");

                        const manifest = JSON.parse(text);

                        let changed = false;

                        /*
                         * ONLY change the HEADER
                         */

                        if (
                            manifest.header &&
                            typeof manifest.header === "object"
                        ) {

                            if (
                                Object.prototype.hasOwnProperty.call(
                                    manifest.header,
                                    "name"
                                )
                            ) {

                                manifest.header.name = "pack.name";
                                changed = true;

                            }

                            if (
                                Object.prototype.hasOwnProperty.call(
                                    manifest.header,
                                    "description"
                                )
                            ) {

                                manifest.header.description =
                                    "pack.description";

                                changed = true;

                            }

                        }

                        manifestCount++;

                        if (changed) {

                            archive.file(
                                path,
                                JSON.stringify(
                                    manifest,
                                    null,
                                    2
                                )
                            );

                            changedCount++;

                        }

                    } catch (error) {

                        console.warn(
                            "Could not process manifest:",
                            path,
                            error
                        );

                    }

                    continue;
                }

                /*
                 * Nested .mcpack / .mcaddon
                 */

                if (
                    lowerPath.endsWith(".mcpack") ||
                    lowerPath.endsWith(".mcaddon") ||
                    lowerPath.endsWith(".zip")
                ) {

                    try {

                        const nestedData =
                            await entry.async("uint8array");

                        const nestedZip =
                            await JSZip.loadAsync(nestedData);

                        /*
                         * Remember this Minecraft pack.
                         */

                        if (
                            lowerPath.endsWith(".mcpack") ||
                            lowerPath.endsWith(".mcaddon")
                        ) {

                            packFiles.push({
                                path: path,
                                type: lowerPath.endsWith(".mcaddon")
                                    ? "mcaddon"
                                    : "mcpack"
                            });

                        }

                        /*
                         * Process everything inside it.
                         */

                        await processArchive(nestedZip);

                        /*
                         * Rebuild the nested archive.
                         */

                        const rebuilt =
                            await nestedZip.generateAsync({
                                type: "uint8array",
                                compression: "DEFLATE",
                                compressionOptions: {
                                    level: 6
                                }
                            });

                        /*
                         * Put the fixed archive back
                         * into the parent archive.
                         */

                        archive.file(
                            path,
                            rebuilt
                        );

                    } catch (error) {

                        console
