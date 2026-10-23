

function SidebarSocails({ icon, link, onNavigate, isCollapsed }) {
    // Open Link
    function openLink() {
        window.location.href = link
    }
    
    return(
        <>
            <button className="socail-btn" onClick={openLink}>
                <i className={icon}></i>
            </button>
        </>
    );
}

export default SidebarSocails