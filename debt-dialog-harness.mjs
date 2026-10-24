import fs from 'node:fs'
import ts from 'typescript'

const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
const react = url('export const useState = initial => { const h=globalThis.debtHarness; const index=h.index++; if (!(index in h.state)) h.state[index]=typeof initial === "function" ? initial() : initial; return [h.state[index], value=>{h.state[index]=typeof value === "function" ? value(h.state[index]) : value}]; }; export const useRef = initial => { const h=globalThis.debtHarness; const index=h.index++; return h.state[index] ||= {current:initial}; }; export const useEffect = fn => { const h=globalThis.debtHarness; h.index++; if(h.initial) h.effects.push(fn); }; export const createContext = initial => ({ initial });')
const jsx = url('export const jsx = (type,props)=>({type,props}); export const jsxs=jsx;')
const i18n = url('export const useTranslation = ()=>({t:(key,values={})=>String(key).replace(/\{\{(\w+)\}\}/g,(_,name)=>String(values[name]??""))});')
const autocomplete = url('export default function Autocomplete(){}; export const createFilterOptions = ()=> (options,state)=>options.filter(option=>option.name.toLowerCase().includes(state.inputValue.toLowerCase()));')
const textField = url('export default function TextField(){}')

export const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]
export const textOf = tree => tree == null || typeof tree === 'boolean' ? '' : typeof tree !== 'object' ? String(tree) : Array.isArray(tree) ? tree.map(textOf).join('') : textOf(tree.props?.children)

export const createDebtHarness = async (apiUrl, direction = 'they_owe_me') => {
  const code = ts.transpileModule(fs.readFileSync('src/components/AddDebtDialog.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
    .replace('"react/jsx-runtime"', JSON.stringify(jsx)).replace("'react'",JSON.stringify(react)).replace("'react-i18next'",JSON.stringify(i18n)).replace("'@mui/material/Autocomplete'",JSON.stringify(autocomplete)).replace("'@mui/material/TextField'",JSON.stringify(textField)).replace("'../api'",JSON.stringify(apiUrl))
  const Component = (await import(url(code))).default
  const harness = { index:0,state:[],initial:true,effects:[],created:[],closed:0,cleanups:[] }
  const render = () => { globalThis.debtHarness=harness; harness.index=0; return Component({ direction,onClose:()=>harness.closed++,onCreated:debt=>harness.created.push(debt) }) }
  render()
  harness.initial=false
  for (const effect of harness.effects) harness.cleanups.push(effect())
  for (let index=0; index<100 && harness.state[3]; index++) await new Promise(resolve=>setTimeout(resolve,10))
  return {
    render,harness,
    autocomplete:()=>nodes(render()).find(node=>node.type?.name==='Autocomplete'),
    amount:value=>{const input=nodes(render()).find(node=>node.type==='input'&&node.props.type==='number');input.props.onChange({target:{value:String(value)}})},
    save:()=>nodes(render()).find(node=>node.type==='form').props.onSubmit({preventDefault(){}}),
    cancel:()=>nodes(render()).find(node=>node.type==='button'&&textOf(node)==='Отмена').props.onClick(),
    unmount:()=>harness.cleanups.forEach(cleanup=>cleanup?.())
  }
}
