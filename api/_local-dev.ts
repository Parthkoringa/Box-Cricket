import 'dotenv/config';

const { app } = await import('./_src/app');

app.listen(3000, () => {
  console.log('API listening on http://localhost:3000');
});
