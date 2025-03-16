const Button = ({onClick, text, className}: {onClick: () => void, text: string, className: string}) => {
    className = `${className} text-4xl block`
    return (
        <div className="button cursor-pointer text-center rounded-md mt-2 mb-2 mr-1 ml-1 pr-2 pl-2 pt-1 pb-1 hover:bg-gray-300" onClick={onClick}>
            <i className={className} style={{ width: 'initial'}}></i>
            <span className="block">{text}</span>
        </div>
    )
}
  
export default Button