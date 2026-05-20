const fs = require('fs');
const path = require('path');

const paths = [
    path.join(__dirname, 'routes'),
    path.join(__dirname, 'utils'),
    __dirname
];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Mongoose methods -> Sequelize methods
    // Note: this is a heuristic and might require manual fixes, but for simple queries it often works.

    // .findById(id) -> .findByPk(id)
    content = content.replace(/\.findById\(/g, '.findByPk(');

    // .findByIdAndDelete(id) -> .destroy({ where: { id } }) -> Wait, findByIdAndDelete returns the doc.
    // Sequelize doesn't have findByIdAndDelete, we have to find and destroy or just destroy directly.
    // Instead of complex parsing, I'll change common patterns:
    // Model.findByIdAndDelete(req.params.id) -> 
    content = content.replace(/\.findByIdAndDelete\((.*?)\)/g, '.destroy({ where: { id: $1 } })');

    // Model.findByIdAndUpdate(id, data, { new: true }) -> 
    // It's hard to one-line this. 

    // Model.findOneAndDelete(query) -> Model.destroy({ where: query })
    content = content.replace(/\.findOneAndDelete\((.*?)\)/g, '.destroy({ where: $1 })');

    // Model.deleteMany(query) -> Model.destroy({ where: query })
    content = content.replace(/\.deleteMany\((.*?)\)/g, '.destroy({ where: $1 })');
    content = content.replace(/\.deleteOne\((.*?)\)/g, '.destroy({ where: $1 })');

    content = content.replace(/\.find\(\)/g, '.findAll()');
    // Model.find({ query }) -> Model.findAll({ where: { query } })
    // Exception: .find() with no args shouldn't get where: {}.
    // We'll replace .find({ by .findAll({ where: {
    content = content.replace(/\.find\(\{/g, '.findAll({ where: {');

    // Sorting: .sort('-createdAt') -> .findAll({ order: [['createdAt', 'DESC']] })
    content = content.replace(/\.sort\(['"]-createdAt['"]\)/g, "({ order: [['createdAt', 'DESC']] })");
    content = content.replace(/\.sort\(['"]order['"]\)/g, "({ order: [['order', 'ASC']] })");

    // .findOne({ query }) -> .findOne({ where: { query } })
    content = content.replace(/\.findOne\(\{/g, '.findOne({ where: {');

    // .countDocuments({ query }) -> .count({ where: { query } })
    content = content.replace(/\.countDocuments\(\{/g, '.count({ where: {');

    // .populate() -> include: [] (Very complex to regex, we can ignore for now or manually fix).

    // .select(...) -> attributes: []

    // new Model(data).save() -> Model.create(data) in most places? No, they usually do:
    // const user = new User({ ... }); await user.save();
    // We can let save() be, as Sequelize instances also have .save(). Sequelize create sets 'id' not '_id'.

    // Fix _id to id in queries
    content = content.replace(/_id/g, 'id');

    fs.writeFileSync(filePath, content);
}

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.wwebjs')) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.js') && file !== 'migrateRoutes.js' && file !== 'migrateModels.js' && !fullPath.includes('models')) {
            console.log('Processing', fullPath);
            processFile(fullPath);
        }
    }
}

paths.forEach(p => {
    if (fs.statSync(p).isDirectory()) {
        processDir(p);
    } else if (p.endsWith('.js')) {
        processFile(p);
    }
});
console.log('Migration code replacements done.');
