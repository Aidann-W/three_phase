import {useState} from 'react'
import { usePost } from './hooks';
import './App.css'

function App() {
    const [user, setUser] = useState('');
    const [pass, setPass] = useState('');
    const [postToggle, setPostToggle] = useState(false)
    usePost(user, pass, postToggle, () => setPostToggle(false));

    return (
        <>
            <div>
                <input value={user} onChange={e => setUser(e.target.value)} placeholder="user"/>
                <input value={pass} onChange={e => setPass(e.target.value)} placeholder="Password"/>

            </div>


            <div>
                <button onClick={() => setPostToggle(true)

                }>Log In</button>
            </div>
        </>
    )
}

export default App
