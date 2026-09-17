async function fixPack() {

    const fileInput = document.getElementById("file");
    const status = document.getElementById("status");
    const button = document.getElementById("fixButton");

    if (!fileInput.files.length) {
        status.textContent = "Please select a pack file.";
        return;
    }

    const file = fileInput.files[0];
    const fileName = file.name.toLowerCase();

    if (
        !fileName.endsWith(".zip") &&
        !fileName.endsWith(".mcpack") &&
        !fileName.endsWith(".mcaddon") &&
        !fileName.endsWith(".mctemplate")
    ) {
        status.textContent =
            "Only .zip, .mcpack, .mcaddon and .mctemplate files are supported.";
        return;
    }

    try {

        button.disabled = true;
        status.textContent = "Reading pack...";

        const zip = await JSZip.loadAsync(file);

        let fixedCount = 0;
        let nestedPackCount = 0;


        /*
        ==========================================
        FIX A MANIFEST
        ==========================================
        */

        async function fixManifest(zipObject, manifestPath) {

            try {

                const manifestFile =
                    zipObject.file(manifestPath);

                if (!manifestFile) return false;

                const text =
                    await manifestFile.async("text");

                const manifest =
                    JSON.parse(text);

                let changed = false;


                /*
                ONLY CHANGE HEADER
                */

                if (manifest.header) {

                    if (
                        Object.prototype.hasOwnProperty.call(
                            manifest.header,
                            "name"
                        )
                    ) {

                        manifest.header.name =
                            "pack.name";

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


                if (changed) {

                    zipObject.file(
                        manifestPath,
                        JSON.stringify(
                            manifest,
                            null,
                            2
                        )
                    );

                    fixedCount++;

                }

                return true;

            } catch (error) {

                console.warn(
                    "Could not process manifest:",
                    manifestPath,
                    error
                );

                return false;
            }
        }


        /*
        ==========================================
        RECURSIVELY SCAN ZIP
        ==========================================
        */

        async function scanZip(zipObject) {

            const entries = [];

            zipObject.forEach((path, entry) => {

                if (!entry.dir) {
                    entries.push({
                        path,
                        entry
                    });
                }

            });


            /*
            FIRST:
            Find every manifest directly inside
            this archive, including folders such as:

            behavior_packs/BP/manifest.json
            resource_packs/RP/manifest.json
            */

            for (const item of entries) {

                if (
                    item.path
                        .toLowerCase()
                        .endsWith("manifest.json")
                ) {

                    await fixManifest(
                        zipObject,
                        item.path
                    );
                }

            }


            /*
            SECOND:
            Look for nested MC files
            */

            for (const item of entries) {

                const lower =
                    item.path.toLowerCase();


                const isNestedPack =
                    lower.endsWith(".mcpack") ||
                    lower.endsWith(".mcaddon") ||
                    lower.endsWith(".mctemplate");


                if (!isNestedPack) {
                    continue;
                }


                try {

                    status.textContent =
                        "Checking " + item.path + "...";


                    const nestedData =
                        await item.entry.async("arraybuffer");


                    const nestedZip =
                        await JSZip.loadAsync(nestedData);


                    nestedPackCount++;


                    /*
                    Recursively process it
                    */

                    await scanZip(nestedZip);


                    /*
                    Put the modified archive back
                    */

                    const rebuilt =
                        await nestedZip.generateAsync({
                            type: "uint8array",
                            compression: "DEFLATE",
                            compressionOptions: {
                                level: 6
                            }
                        });


                    zipObject.file(
                        item.path,
                        rebuilt
                    );


                } catch (error) {

                    console.warn(
                        "Could not open nested pack:",
                        item.path,
                        error
                    );

                }

            }

        }


        /*
        ==========================================
        START SCAN
        ==========================================
        */

        await scanZip(zip);


        if (fixedCount === 0) {

            throw new Error(
                "No manifest header name or description fields were found."
            );

        }


        /*
        ==========================================
        DETERMINE OUTPUT EXTENSION
        ==========================================
        */

        let outputName;


        /*
        .mctemplate stays .mctemplate
        */

        if (
            fileName.endsWith(".mctemplate")
        ) {

            outputName =
                file.name.replace(
                    /\.mctemplate$/i,
                    ""
                ) + ".mctemplate";

        }


        /*
        .mcaddon stays .mcaddon
        */

        else if (
            fileName.endsWith(".mcaddon")
        ) {

            outputName =
                file.name.replace(
                    /\.mcaddon$/i,
                    ""
                ) + ".mcaddon";

        }


        /*
        .mcpack stays .mcpack
        */

        else if (
            fileName.endsWith(".mcpack")
        ) {

            outputName =
                file.name.replace(
                    /\.mcpack$/i,
                    ""
                ) + ".mcpack";

        }


        /*
        ZIP:
        multiple packs = MCADDON
        single/normal pack = MCPACK
        */

        else {

            const baseName =
                file.name.replace(
                    /\.zip$/i,
                    ""
                );


            if (nestedPackCount >= 2) {

                outputName =
                    baseName
                        .replace(
                            /\.(mcaddon|mcpack)$/i,
                            ""
                        ) + ".mcaddon";

            } else {

                outputName =
                    baseName
                        .replace(
                            /\.(mcaddon|mcpack)$/i,
                            ""
                        ) + ".mcpack";

            }

        }


        /*
        ==========================================
        CREATE DOWNLOAD
        ==========================================
        */

        status.textContent =
            "Creating fixed pack...";


        const output =
            await zip.generateAsync({

                type: "blob",

                compression: "DEFLATE",

                compressionOptions: {
                    level: 6
                }

            });


        const url =
            URL.createObjectURL(output);


        const download =
            document.createElement("a");


        download.href = url;
        download.download = outputName;


        document.body.appendChild(download);

        download.click();

        download.remove();


        URL.revokeObjectURL(url);


        status.textContent =
            `Done! Fixed ${fixedCount} manifest(s).`;

    }


    catch (error) {

        console.error(error);

        status.textContent =
            "Error: " + error.message;

    }


    finally {

        button.disabled = false;

    }

}
