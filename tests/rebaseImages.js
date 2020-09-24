const fs = require('fs');
const {parse} = require('fast-csv');
// const csv = require('@fast-csv/parse');

(async () => {

    const regex = /(?:[/dp/]|$)([A-Z0-9]{10})/g;
    //
    // const paragraph = 'https://www.amazon.com/dp/B07PMCKV39';
    // const m = paragraph.match(regex);
    //
    // console.log(m[0].replace("/",""))

    const readInCsv = async (csvFile) => {
        const tasks = []
        const lines = fs.readFileSync(csvFile).toString().split("\n");

        const stream = parse({ headers: true })
            .transform((data) => ({
                sku: data.sku.toUpperCase(),
                amazon_url: data.amazon_url.match(regex)[0].replace("/", "")
            }))
            .on('error', error => console.error(error))
            .on('data', row => tasks.push(row))
            .on('end', (rowCount) => {
                console.log(`Parsed ${rowCount} rows`)
                console.log(tasks);
            });

        lines.forEach(row => {
            stream.write(row)
        })

        return tasks

        // await csv.parseFile(csvFile, {headers: true})
        //     .transform((data) => ({
        //         sku: data.sku.toUpperCase(),
        //         amazon_url: data.amazon_url.match(regex)[0].replace("/", "")
        //     }))
        //     .on('error', error => console.error(error))
        //     .on('data', row => tasks.push(row))
        //     .on('end', rowCount => {
        //             console.log(`Parsed ${rowCount} rows`);
        //             return tasks
        //         }
        //     )
    }

    const a = await readInCsv('input.csv');
    console.log(JSON.stringify(a))

})
();




