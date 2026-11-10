import {migrate} from '../src/database/index.js';import {db} from '../src/database/index.js';migrate();console.log('Database migrations applied.');db.close();
