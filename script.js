async function fixPack() {

    const fileInput =
        document.getElementById("file");

    const status =
        document.getElementById("status");

    const button =
        document.getElementById("fixButton");


    /*
        Check if a file was selected
    */

    if (!fileInput.files.length) {

        status.textContent =
            "Please select a .mcpack, .mcaddon, or .zip file.";

        return;
    }


    const file =
        fileInput.files[0];


    const fileName =
        file.name.toLowerCase();


    /*
        Check file type
    */

    if (
        !fileName.endsWith(".zip") &&
        !fileName.endsWith(".mcpack") &&
        !fileName.endsWith(".mcaddon")
    ) {

        status.textContent =
            "Only .zip, .mcpack, and .mcaddon files are supported.";

        return;
    }


    try {

        button.disabled = true;

        status.textContent =
            "Reading pack...";


        /*
            Keep track of Minecraft packs
            found inside the uploaded file.
        */

        let packFiles = [];

        let manifestCount = 0;

        let fixedCount = 0;


        /*
            Process an archive recursively.

            This allows:

            ZIP
            ├── RP.mcpack
            └── BP.mcpack

            and:

            addon.mcaddon
            ├── RP.mcpack
            └── BP.mcpack
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

                const path =
                    item.path;

                const entry =
                    item.entry;

                const lowerPath =
                    path.toLowerCase();


                /*
                    ==========================
                    MANIFEST.JSON
                    ==========================
                */

                if (
                    lowerPath.endsWith("manifest.json")
                ) {

                    try {

                        const text =
                            await entry.async("text");


                        const manifest =
                            JSON.parse(text);


                        let changed = false;


                        /*
                            ONLY change HEADER.

                            Module names and descriptions
                            are intentionally untouched.
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

                            fixedCount++;

                        }

                    }

                    catch (error) {

                        console.warn(
                            "Could not process manifest:",
                            path,
                            error
                        );

                    }

                    continue;

                }


                /*
                    ==========================
                    NESTED PACKS
                    ==========================
                */

                if (
                    lowerPath.endsWith(".mcpack") ||
                    lowerPath.endsWith(".mcaddon") ||
                    lowerPath.endsWith(".zip")
                ) {

                    try {

                        const nestedData =
                            await entry.async("uint8array");


                        const nestedArchive =
                            await JSZip.loadAsync(
                                nestedData
                            );


                        /*
                            Remember actual Minecraft packs.

                            Generic .zip files are not
                            counted as Minecraft packs.
                        */

                        if (
                            lowerPath.endsWith(".mcpack")
                        ) {

                            packFiles.push("mcpack");

                        }

                        else if (
                            lowerPath.endsWith(".mcaddon")
                        ) {

                            packFiles.push("mcaddon");

                        }


                        /*
                            Process manifests inside it.
                        */

                        await processArchive(
                            nestedArchive
                        );


                        /*
                            Rebuild the nested archive.
                        */

                        const rebuilt =
                            await nestedArchive.generateAsync({

                                type: "uint8array",

                                compression: "DEFLATE",

                                compressionOptions: {
                                    level: 6
                                }

                            });


                        /*
                            Put the modified archive
                            back into its parent.
                        */

                        archive.file(
                            path,
                            rebuilt
                        );

                    }

                    catch (error) {

                        console.warn(
                            "Could not process nested archive:",
                            path,
                            error
                        );

                    }

                }

            }

        }


        /*
            Load the uploaded file.
        */

        const zip =
            await JSZip.loadAsync(file);


        /*
            Process everything.
        */

        await processArchive(zip);


        /*
            Make sure manifests were found.
        */

        if (manifestCount === 0) {

            throw new Error(
                "No manifest.json files were found."
            );

        }


        /*
            Make sure something changed.
        */

        if (fixedCount === 0) {

            throw new Error(
                "No header name or description fields were found."
            );

        }


        status.textContent =
            `Fixed ${fixedCount} manifest(s).`;


        /*
            ==========================
            OUTPUT TYPE
            ==========================

            One .mcpack
                → .mcpack

            One .mcaddon
                → .mcaddon

            Multiple packs
                → .mcaddon

            Uploaded .mcaddon
                → .mcaddon

            Uploaded .mcaddon.zip
                → .mcaddon
        */

        let outputExtension =
            ".mcpack";


        if (
            packFiles.length > 1
        ) {

            outputExtension =
                ".mcaddon";

        }

        else if (
            packFiles.length === 1 &&
            packFiles[0] === "mcaddon"
        ) {

            outputExtension =
                ".mcaddon";

        }

        else if (
            fileName.endsWith(".mcaddon") ||
            fileName.endsWith(".mcaddon.zip")
        ) {

            outputExtension =
                ".mcaddon";

        }


        /*
            If the ZIP itself contains multiple
            direct manifests/packs, treat it
            as an addon.
        */

        if (
            packFiles.length > 1
        ) {

            outputExtension =
                ".mcaddon";

        }


        /*
            Remove existing extensions.

            Examples:

            test.zip
            test.mcpack
            test.mcaddon
            test.mcaddon.zip

            all become:

            test
        */

        let baseName =
            file.name;


        baseName =
            baseName.replace(
                /(\.mcpack|\.mcaddon|\.zip)+$/i,
                ""
            );


        const outputName =
            baseName + outputExtension;


        /*
            ==========================
            CREATE OUTPUT
            ==========================
        */

        status.textContent =
            "Creating " + outputName + "...";


        const output =
            await zip.generateAsync({

                type: "blob",

                compression: "DEFLATE",

                compressionOptions: {
                    level: 6
                }

            });


        /*
            Download
        */

        const url =
            URL.createObjectURL(output);


        const download =
            document.createElement("a");


        download.href =
            url;


        download.download =
            outputName;


        document.body.appendChild(
            download
        );


        download.click();


        download.remove();


        /*
            Clean up
        */

        setTimeout(() => {

            URL.revokeObjectURL(url);

        }, 1000);


        status.textContent =
            `Done! Fixed ${fixedCount} manifest(s) → ${outputName}`;


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
