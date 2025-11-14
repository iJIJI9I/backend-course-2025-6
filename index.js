const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swaggerDef');

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


const upload = multer({ storage: storage });

/**
 * @swagger
 * /:
 *   get:
 *     summary: Перевірка стану сервера
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Сервер працює
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<h1>Привіт з мого Express сервісу інвентаризації</h1><p>Сервер працює!</p>"
 */
app.get('/', (req, res) => {
    res.send(`<h1>Привіт з мого Express сервісу інвентаризації</h1><p>Сервер працює!</p>`);
});

/**
 * @swagger
 * /RegisterForm.html:
 *   get:
 *     summary: Отримати HTML-форму для реєстрації нового інвентарного пристрою
 *     tags: [Forms]
 *     responses:
 *       200:
 *         description: HTML-форма для реєстрації
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<!DOCTYPE html>..."
 *       404:
 *         description: Форму не знайдено
 *       500:
 *         description: Помилка сервера
 */
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

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Зареєструвати новий інвентарний пристрій
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Назва інвентарного пристрою
 *                 example: "Cat picture"
 *               description:
 *                 type: string
 *                 description: Опис інвентарного пристрою
 *                 example: "Супер картинка"
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Фотографія пристрою
 *             required:
 *               - inventory_name
 *     responses:
 *       201:
 *         description: Пристрій успішно зареєстровано
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         description: Некоректний запит (наприклад, відсутнє ім'я)
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Помилка сервера
 */

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

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати список усіх інвентарних пристроїв
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Список інвентарних пристроїв
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InventoryItems'
 *       500:
 *         description: Помилка сервера
 */
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

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати інформацію про інвентарний пристрій за ID
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID інвентарного пристрою
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Інформація
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItems'
 *       404:
 *         description: Пристрій не знайдено
 *       500:
 *         description: Помилка сервера
 */
app.get(`/inventory/:id`, (req, res) => {
    const itemId = req.params.id;
    const itemFilePath = path.join(cacheDir, `${itemId}.json`);
    fs.readFile(itemFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Помилка при читанні файлу для ID ${itemId}:`, err.message);
            if (err.code === 'ENOENT') {
                console.warn(`Елемент з ID ${itemId} не знайдено.`);
                return res.status(404).send('Елемент не знайдено.');
            }
            console.error(`Помилка сервера при отриманні елемента з ID ${itemId}:`, err.message);
            return res.status(500).send('Помилка сервера при отриманні елемента.');
        }

        try {
            const itemData = JSON.parse(data);
            res.status(200).json(itemData);
        } catch (parseErr) {
            console.error(`Помилка при парсингу JSON для ID ${itemId}:`, parseErr.message);
            res.status(500).send('Помилка сервера при обробці даних елемента.');
        }
    });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фотографію інвентарного пристрою за ID
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID інвентарного пристрою
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Файл фотографії
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Пристрій або фото не знайдено
 *       500:
 *         description: Помилка сервера
 */
app.get('/inventory/:id/photo', (req, res) => {
    const itemId = req.params.id;
    const itemFilePath = path.join(cacheDir, `${itemId}.json`);
    fs.readFile(itemFilePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`Елемент з ID ${itemId} не знайдено.`);
                return res.status(404).send('Елемент не знайдено.');
            }
            console.error(`Помилка при читанні файлу для ID ${itemId}:`, err.message);
            return res.status(500).send('Помилка сервера при отриманні елемента.');
        }
        try {
            const item = JSON.parse(data);
            const photoFilename = item.photo_path;

            if (!photoFilename) {
                console.warn(`Фото для елемента з ID ${itemId} не знайдено.`);
                return res.status(404).send('Фото не знайдено.');
            }
            const photoFilePath = path.join(cacheDir, 'photos', photoFilename);
            fs.access(photoFilePath, fs.constants.F_OK, (accessErr) => {
                if (accessErr) {
                    console.warn(`Файл фото не знайдено за шляхом: ${photoFilePath}`);
                    return res.status(404).send('Фото не знайдено.');
                }
                const contentType = `image/${path.extname(photoFilename).substring(1)}`;
                res.setHeader('Content-Type', contentType); 
                res.sendFile(photoFilePath);
            }); 
        } catch (parseErr) {
            console.error(`Помилка при парсингу JSON для ID ${itemId}:`, parseErr.message);
            res.status(500).send('Помилка сервера при обробці даних елемента.');
        }
    });
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Оновити інформацію про інвентарний пристрій за ID
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID інвентарного пристрою
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *                 description: Нова назва пристрою
 *                 example: "Cat picture"
 *               description:
 *                 type: string
 *                 description: Новий опис пристрою
 *                 example: "Супер картинка"
 *     responses:
 *       200:
 *         description: Пристрій успішно оновлено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         description: Некоректний запит (порожнє тіло)
 *       404:
 *         description: Пристрій не знайдено
 *       500:
 *         description: Помилка сервера
 */
app.put('/inventory/:id', (req, res) => {
    const itemId = req.params.id;
    const itemFilePath = path.join(cacheDir, `${itemId}.json`);

    fs.readFile(itemFilePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`Елемент з ID ${itemId} не знайдено для оновлення.`);
                return res.status(404).send('Елемент не знайдено.');
            }
            console.error(`Помилка при читанні файлу для ID ${itemId} під час оновлення:`, err.message);
            return res.status(500).send('Помилка сервера при читанні даних для оновлення.');
        }

        try {
            let itemData = JSON.parse(data);
            const { inventory_name, description } = req.body;

            let updated = false;

            if (inventory_name !== undefined) {
                itemData.inventory_name = inventory_name;
                updated = true;
            }
            if (description !== undefined) {
                itemData.description = description;
                updated = true;
            }

           
            if (!updated && Object.keys(req.body).length > 0) {
                 console.warn(`PUT /inventory/${itemId}: Запит містив дані, але вони не були 'inventory_name' або 'description'. Нічого не змінено.`);
                
                 return res.status(200).json(itemData);
            } else if (!updated && Object.keys(req.body).length === 0) {
             
                return res.status(400).send('Bad Request: Тіло запиту порожнє або не містить полів для оновлення.');
            }

            fs.writeFile(itemFilePath, JSON.stringify(itemData, null, 2), (writeErr) => {
                if (writeErr) {
                    console.error(`Помилка при записі оновлених даних для ID ${itemId}:`, writeErr.message);
                    return res.status(500).send('Помилка сервера при збереженні оновлених даних.');
                }
                console.log(`Елемент з ID ${itemId} успішно оновлено.`);
                res.status(200).json(itemData);
            });

        } catch (parseErr) {
            console.error(`Помилка при парсингу JSON для ID ${itemId} під час оновлення:`, parseErr.message);
            res.status(500).send('Помилка сервера при обробці даних елемента для оновлення.');
        }
    });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновити фотографію інвентарного пристрою за ID
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID інвентарного пристрою
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Нова фотографія
 *             required:
 *               - photo
 *     responses:
 *       200:
 *         description: Фотографію успішно оновлено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItems'
 *       400:
 *         description: Файл фото не надано
 *       404:
 *         description: Пристрій не знайдено
 *       500:
 *         description: Помилка сервера
 */
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
    const itemId = req.params.id;
    const itemFilePath = path.join(cacheDir, `${itemId}.json`);
    const newPhotoFile = req.file; 

    if (!newPhotoFile) {
        console.warn(`PUT /inventory/${itemId}/photo: Немає файлу фото у запиті.`);
        return res.status(400).send('Bad Request: Файл фото не надано.');
    }

    fs.readFile(itemFilePath, 'utf8', (err, data) => {
        if (err) {
        
            if (newPhotoFile) {
                fs.unlink(newPhotoFile.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Помилка при видаленні нового фото після 404:', unlinkErr.message);
                });
            }
            if (err.code === 'ENOENT') {
                console.warn(`Елемент з ID ${itemId} не знайдено для оновлення фото.`);
                return res.status(404).send('Елемент не знайдено.');
            }
            console.error(`Помилка при читанні файлу для ID ${itemId} під час оновлення фото:`, err.message);
            return res.status(500).send('Помилка сервера при читанні даних для оновлення фото.');
        }

        try {
            let itemData = JSON.parse(data);

           
            if (itemData.photo_path) {
                const oldPhotoPath = path.join(cacheDir, 'photos', itemData.photo_path);
                fs.unlink(oldPhotoPath, (unlinkErr) => {
                    if (unlinkErr && unlinkErr.code !== 'ENOENT') { 
                        console.error(`Помилка при видаленні старого фото ${itemData.photo_path}:`, unlinkErr.message);
                    } else if (!unlinkErr) {
                         console.log(`Старе фото ${itemData.photo_path} для елемента ${itemId} успішно видалено.`);
                    }
                });
            }

       
            itemData.photo_path = newPhotoFile.filename;
            itemData.photo_url = `/inventory/${itemId}/photo`;

            fs.writeFile(itemFilePath, JSON.stringify(itemData, null, 2), (writeErr) => {
                if (writeErr) {
                    console.error(`Помилка при записі оновлених даних фото для ID ${itemId}:`, writeErr.message);
                  
                    if (newPhotoFile) {
                        fs.unlink(newPhotoFile.path, (unlinkErr) => {
                            if (unlinkErr) console.error('Помилка при видаленні нового фото після помилки запису JSON:', unlinkErr.message);
                        });
                    }
                    return res.status(500).send('Помилка сервера при збереженні оновлених даних фото.');
                }
                console.log(`Фото для елемента з ID ${itemId} успішно оновлено.`);
                res.status(200).json(itemData);
            });

        } catch (parseErr) {
            
            if (newPhotoFile) {
                fs.unlink(newPhotoFile.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Помилка при видаленні нового фото після помилки парсингу JSON:', unlinkErr.message);
                });
            }
            console.error(`Помилка при парсингу JSON для ID ${itemId} під час оновлення фото:`, parseErr.message);
            res.status(500).send('Помилка сервера при обробці даних елемента для оновлення фото.');
        }
    });
}); 
   
/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Видалити інвентарний пристрій за ID
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID інвентарного пристрою
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Пристрій успішно видалено
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       404:
 *         description: Пристрій не знайдено
 *       500:
 *         description: Помилка сервера
 */
app.delete('/inventory/:id', (req, res) => {
    const itemId = req.params.id;
    const itemFilePath = path.join(cacheDir, `${itemId}.json`);

    fs.readFile(itemFilePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`Елемент з ID ${itemId} не знайдено для видалення.`);
                return res.status(404).send('Елемент не знайдено.'); 
            }
            console.error(`Помилка при читанні файлу для ID ${itemId} під час видалення:`, err.message);
            return res.status(500).send('Помилка сервера при читанні даних для видалення.');
        }
        try {
            let itemData = JSON.parse(data);
            if (itemData.photo_path) {
                const photoPath = path.join(cacheDir, 'photos', itemData.photo_path);
                fs.unlink(photoPath, (unlinkErr) => {
                    if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                        console.error(`Помилка при видаленні фото ${itemData.photo_path}:`, unlinkErr.message);
                    }  else if (!unlinkErr) {   
                        console.log(`Фото ${itemData.photo_path} для елемента ${itemId} успішно видалено.`);
                    }
                });
            }
            fs.unlink(itemFilePath,(deleteErr) => {
                if (deleteErr) {
                    console.error(`Помилка при видаленні файлу для ID ${itemId}:`, deleteErr.message);
                    return res.status(500).send('Помилка сервера при видаленні елемента.');
                }
                console.log(`Елемент з ID ${itemId} успішно видалено.`);
                res.status(200).send('Елемент успішно видалено.');
            }   );
        } catch (parseErr) {
            console.error(`Помилка при парсингу JSON для ID ${itemId} під час видалення:`, parseErr.message);
            res.status(500).send('Помилка сервера при обробці даних елемента для видалення.');
        }   
    });
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук інвентарного пристрою за ID з опцією фільтрації по фото
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: ID інвентарного пристрою для пошуку
 *                 example: "1678886400000"
 *               has_photo:
 *                 type: boolean
 *                 description: Фільтрувати чи має пристрій фотографію (true/false)
 *                 example: true
 *             required:
 *               - id
 *     responses:
 *       200:
 *         description: Інформація про знайдений пристрій
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryItem'
 *       400:
 *         description: Некоректний запит (не вказано ID)
 *       404:
 *         description: Пристрій не знайдено
 *       500:
 *         description: Помилка сервера
 */
app.post(`/search`, (req, res) => {
    const itemid = req.body.id;
    const hasPhoto = req.body.has_photo === 'on' || req.body.has_photo === true;

    if (!itemid) {
        console.warn('POST /search: Не вказано ID для пошуку.');
        return res.status(400).send('Bad Request: Не вказано ID для пошуку.');
    }
    const itemFilePath = path.join(cacheDir, `${itemid}.json`);
    fs.readFile(itemFilePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                console.warn(`POST /search: Елемент з ID ${itemid} не знайдено.`);
                return res.status(404).send('Елемент не знайдено.');
            }
            console.error(`POST /search: Помилка при читанні файлу для ID ${itemid}:`, err.message);
            return res.status(500).send('Помилка сервера при читанні даних елемента.');
        }
        try {
            const itemData = JSON.parse(data);
            
          
            delete itemData.photo_path; 

            
            if (hasPhoto && itemData.photo_url) { 
                
            } else {
                
                delete itemData.photo_url;
            }

            res.status(200).json(itemData);
        } catch (parseErr) {
            console.error(`POST /search: Помилка при парсингу JSON для ID ${itemid}:`, parseErr.message);
            res.status(500).send('Помилка сервера при обробці даних елемента.');
        }
    });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.listen(options.port, options.host, () => {
  console.log(`Express сервер запущено за адресою: http://${options.host}:${options.port}`);
  console.log(`Директорія кешу: ${cacheDir}`);
  console.log(`Для перегляду форми реєстрації: http://${options.host}:${options.port}/RegisterForm.html`);
  console.log(`Для перегляду форми пошуку: http://${options.host}:${options.port}/SearchForm.html`);
  console.log(`Для перегляду списку інвентарю: http://${options.host}:${options.port}/inventory`);
});

                  
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
        return res.status(405).send('Метод не дозволений');
    }
    next();
});