import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';

const port = Number(process.env.PORT || 8000);

connectDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Tether monitoring backend listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start Tether monitoring backend:', error);
    process.exit(1);
  });
