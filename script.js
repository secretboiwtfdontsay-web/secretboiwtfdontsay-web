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
            "Only .zip, .mcpack, .mcaddon files are supported.";

        return;
    }


    try {

        button.disabled = true;


        /*
            Load the uploaded archive
        */

        status.textContent =
            "Reading pack...";


        const zip =
            await JSZip.loadAsync(file);


        /*
            Keep track of actual Minecraft packs
            found inside the archive.
        */

        const packFiles = [];


        let manifestCount = 0;

        let fixedCount = 0;


        /*
            Process an archive.

            This can process:

            addon.mcaddon
            ├── RP.mcpack
            └── BP.mcpack

            and even:

            addon.mcaddon
            ├── RP.mcpack
            └── another.mcaddon
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
                            ONLY CHANGE HEADER

                            module.name and
                            module.description
                            are NOT touched.
                        */

                        if (
                            manifest.header
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


                        /*
                            Save the changed manifest
                        */

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
                    NESTED MCPACK / MCADDON
                    ==========================
                */

                if (
                    lowerPath.endsWith(".mcpack") ||
                    lowerPath.endsWith(".mcaddon")
                ) {

                    try {

                        /*
                            Remember the pack type
                        */

                        if (
                            lowerPath.endsWith(".mcpack")
                        ) {

                            packFiles.push("mcpack");

                        }

                        else {

                            packFiles.push("mcaddon");

                        }


                        /*
                            Open the nested pack
                        */

                        const nestedData =
                            await entry.async(
                                "uint8array"
                            );


                        const nestedZip =
                            await JSZip.loadAsync(
                                nestedData
                            );


                        /*
                            Find manifests inside it.

                            This also finds another
                            .mcpack/.mcaddon inside it.
                        */

                        await processArchive(
                            nestedZip
                        );


                        /*
                            Rebuild the nested pack
                            after modifying it.
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
                            Put the modified pack
                            back into the parent.
                        */

                        archive.file(
                            path,
                            rebuilt
                        );

                    }

                    catch (error) {

                        console.warn(
                            "Could not process nested pack:",
                            path,
                            error
                        );

                    }

                }

            }

        }


        /*
            Start processing the uploaded file
        */

        await processArchive(zip);


        /*
            Make sure a manifest was found
        */

        if (
            manifestCount === 0
        ) {

            throw new Error(
                "No manifest.json files were found."
            );

        }


        /*
            Make sure something changed
        */

        if (
            fixedCount === 0
        ) {

            throw new Error(
                "No header name or description fields were found."
            );

        }


        /*
            ==========================
            CHOOSE OUTPUT TYPE
            ==========================

            1 MCPACK
                → .mcpack

            1 MCADDON
                → .mcaddon

            2+ packs
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
            packFiles.length === 1
        ) {

            outputExtension =
                "." + packFiles[0];

        }

        else if (
            fileName.endsWith(".mcaddon")
        ) {

            outputExtension =
                ".mcaddon";

        }

        else {

            outputExtension =
                ".mcpack";

        }


        /*
            ==========================
            CLEAN FILE NAME
            ==========================

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
