import db from './src/db';
console.log(db.prepare("SELECT id, name, length(image), length(thumbnail) FROM items WHERE image != '' OR thumbnail != '' LIMIT 5").all());
