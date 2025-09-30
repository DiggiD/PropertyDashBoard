import { execSync } from 'child_process';

try {
  execSync('npm test -- --coverage --watchAll=false', { stdio: 'inherit' });
  console.log('All tests passed! Coverage report in /coverage');
} catch (e) {
  console.error('Tests failed:', e);
  process.exit(1);
}
