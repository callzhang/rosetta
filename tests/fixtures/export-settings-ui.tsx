import { createRoot } from 'react-dom/client';
import Page from '../../src/pages/exportSettings/ExportSettingsPage';
const root = createRoot(document.getElementById('root')!);
root.render(<Page />);
globalThis.unmount = () => root.unmount();
