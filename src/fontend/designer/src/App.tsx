import { BrowserRouter, Routes, Route } from 'react-router'
import Start from './pages/Start'
import Work from './pages/Work'
import NotFound from './pages/NotFound'
import './App.css'

function App() {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Start />} />
                    <Route path="/index.html" element={<Start />} />
                    <Route path="/work" element={<Work />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
        </>
    )
}

export default App
