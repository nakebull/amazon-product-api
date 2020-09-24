(async () => {

    const regex = /(?:[/dp/]|$)([A-Z0-9]{10})/g;

    const paragraph = 'https://www.amazon.com/dp/B07PMCKV39';
    const m = paragraph.match(regex);

    console.log(m[0].replace("/",""))

})();




