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
            "Please select a .mcpack or .zip file.";

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
        !fileName.endsWith(".mcpack")
    ) {

        status.textContent =
            "Only .zip and .mcpack files are supported.";

        return;
    }


    try {

        button.disabled = true;


        /*
            Load the pack
        */

        status.textContent =
            "Reading pack...";


        const zip =
            await JSZip.loadAsync(file);


        /*
            Find EVERY manifest.json
        */

        const manifests = [];


        zip.forEach((path, entry) => {

            if (
                !entry.dir &&
                path.toLowerCase().endsWith("manifest.json")
            ) {

                manifests.push(entry);

            }

        });


        /*
            Make sure we found one
        */

        if (manifests.length === 0) {

            throw new Error(
                "No manifest.json files were found."
            );

        }


        status.textContent =
            `Found ${manifests.length} manifest(s).`;


        let fixedCount = 0;


        /*
            Process EVERY manifest
        */

        for (
            const manifestFile
            of manifests
        ) {

            try {

                /*
                    Read manifest
                */

                const text =
                    await manifestFile.async("text");


                /*
                    Convert JSON
                    */

                const manifest =
                    JSON.parse(text);


                let changed = false;


                /*
                    ==========================
                    HEADER
                    ==========================
                */

                if (manifest.header) {


                    /*
                        Change NAME
                    */

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


                    /*
                        Change DESCRIPTION
                    */

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


                /*
                    ==========================
                    MODULES
                    ==========================
                */

                if (
                    Array.isArray(
                        manifest.modules
                    )
                ) {

                    for (
                        const module
                        of manifest.modules
                    ) {


                        if (
                            Object.prototype.hasOwnProperty.call(
                                module,
                                "name"
                            )
                        ) {

                            module.name =
                                "pack.name";

                            changed = true;

                        }


                        if (
                            Object.prototype.hasOwnProperty.call(
                                module,
                                "description"
                            )
                        ) {

                            module.description =
                                "pack.description";

                            changed = true;

                        }

                    }

                }


                /*
                    Save modified manifest
                */

                if (changed) {

                    zip.file(
                        manifestFile.name,

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
                    "Could not process:",
                    manifestFile.name,
                    error
                );

            }

        }


        /*
            Make sure something changed
        */

        if (fixedCount === 0) {

            throw new Error(
                "No name or description fields were found."
            );

        }


        /*
            Create new MCPACK
        */

        status.textContent =
            "Creating .mcpack...";


        const output =
            await zip.generateAsync({

                type: "blob",

                compression: "DEFLATE",

                compressionOptions: {
                    level: 6
                }

            });


        /*
            Remove original extension

            Example:

            CoolPack.zip

            becomes:

            CoolPack.mcpack
        */

        const outputName =
            file.name.replace(
                /\.(zip|mcpack)$/i,
                ""
            ) + ".mcpack";


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
