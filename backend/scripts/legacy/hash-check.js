const bcrypt = require('bcryptjs');
const v = bcrypt.compareSync('smdigitalworks', '$2a$10$vO/qFqS8h/A.R9f9/HqSze8r2o0t70Qf05tNqG4PZpA.1/16H5fRC');
console.log(v);
