const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');

program
    .name(`inventory-service`)
    .description('Сервіс для управління інвентарем')
    .version('1.0.0')
    .requiredOption('-p, --port <number>', 'Порт для запуску сервера', parseInt)
    .requiredOption('-c, --cache <path>', 'Шлях до директорії кешу')
    .requiredOption('-h, --host <string>', 'Хост для сервера');

program.parse(process.argv);

const options = program.opts();


const cacheDir = path.resolve(options.cache); 

if (!fs.existsSync(cacheDir)) {
    console.log(`Директорія кешу '${cacheDir}' не існує. Створюю...`); 
    try {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log(`Директорія кешу '${cacheDir}' створена успішно.`);
    } catch (err) {
        console.error('Не вдалося створити директорію кешу:', err.message); 
        process.exit(1);
    }
} else {
    console.log(`Директорія кешу '${cacheDir}' вже існує.`);
}

console.log('Отримані параметри:');
console.log(`  Порт: ${options.port}`);
console.log(`  Директорія кешу: ${cacheDir}`); 
console.log(`  Хост: ${options.host}`);
console.log(`Програма запущена та готова до роботи.`);


const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const photosDir = path.join(cacheDir, 'photos');
        if (!fs.existsSync(photosDir)) {
            fs.mkdirSync(photosDir, { recursive: true });
        }
        cb(null, photosDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});


const upload = multer({ storage: multer.diskStorage({}) });

app.get('/', (req, res) => {
    res.send(`<h1>Привіт з мого Express сервісу інвентаризації</h1><p>Сервер працює!</p>`);
});

app.get('/RegisterForm.html', (req, res) => {
  const filePath = path.join(__dirname, 'RegisterForm.html'); 
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Помилка при читанні RegisterForm.html:', err.message);
      if (err.code === 'ENOENT') { 
          res.status(404).send('RegisterForm.html не знайдено');
      } else {
          res.status(500).send('Помилка сервера при читанні RegisterForm.html');
      }
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
});

app.get('/SearchForm.html', (req, res) => {
  const filePath = path.join(__dirname, 'SearchForm.html');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Помилка при читанні SearchForm.html:', err.message);
       if (err.code === 'ENOENT') { 
          res.status(404).send('SearchForm.html не знайдено');
      } else {
          res.status(500).send('Помилка сервера при читанні SearchForm.html');
      }
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(data);
  });
});


app.post('/register', upload.single('photo'), (req, res) => {
    const { inventory_name, description } = req.body;
    const photoFile = req.file;

   
    if (!inventory_name) {
        console.error('Помилка реєстрації: Ім\'я речі (inventory_name) не задано.');
        // Тут itemData ще не визначена, тому не посилаємося на неї
        return res.status(400).send('Bad Request: Ім\'я речі (inventory_name) є обов\'язковим.');
    }

  
    const itemId = Date.now().toString(); 

    const itemData = { 
        ID: itemId,
        inventory_name: inventory_name,
        description: description || '',
        photo_path: photoFile ? photoFile.filename : null,
        photo_url: photoFile ? `/inventory/${itemId}/photo` : null
    };


    const itemFilePath = path.join(cacheDir, `${itemId}.json`);
    fs.writeFile(itemFilePath, JSON.stringify(itemData, null, 2), (err) => {
        if (err) {
            console.error(`Помилка при збереженні даних для ID ${itemId}:`, err.message);
            if (photoFile) {
                fs.unlink(photoFile.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Помилка при видаленні завантаженого фото:', unlinkErr.message);
                });
            }
            
            return res.status(500).send('Помилка сервера при реєстрації пристрою.');
        }

        console.log(`Пристрій з ID ${itemId} успішно зареєстровано.`);
        
        res.status(201).json(itemData);
    });
});

app.get('/inventory', (req, res) => {
    const Inventory_Items = [];
    fs.readdir(cacheDir, (err, files) => {
        if (err) {
            console.error('Помилка при читанні директорії кешу:', err.message);
            return res.status(500).send('Помилка сервера при отриманні списку інвентарю.');
        }

        const jsonFiles = files.filter(file => path.extname(file) === '.json');

        if (jsonFiles.length === 0) {
            return res.status(200).json([]);
        }
         
        let filesProcessed = 0;
        jsonFiles.forEach(file => {
            const filePath = path.join(cacheDir, file);
            fs.readFile(filePath, 'utf8', (readErr, data) => {
                filesProcessed++;
                if (readErr) {
                    console.error(`Помилка при читанні файлу ${file}:`, readErr.message);
                } else {
                    try {
                        const itemData = JSON.parse(data);
                        Inventory_Items.push(itemData);
                    } catch (parseErr) {    
                        console.error(`Помилка при парсингу JSON з файлу ${file}:`, parseErr.message);
                    }   
                }
                if (filesProcessed === jsonFiles.length) {
                    res.status(200).json(Inventory_Items);
                }
            });
        });
    });
});
                  
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
        return res.status(405).send('Метод не дозволений');
    }
    next();
});
                


app.listen(options.port, options.host, () => {
  console.log(`Express сервер запущено за адресою: http://${options.host}:${options.port}`);
  console.log(`Директорія кешу: ${cacheDir}`);
  console.log(`Для перегляду форми реєстрації: http://${options.host}:${options.port}/RegisterForm.html`);
  console.log(`Для перегляду форми пошуку: http://${options.host}:${options.port}/SearchForm.html`);
  console.log(`Для перегляду списку інвентарю: http://${options.host}:${options.port}/inventory`);
});