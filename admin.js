import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, setDoc, deleteDoc, getDoc, onSnapshot, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// 🔴 NEW: Import Firebase Auth
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDXYobIjywCtH5_UgIhqaPiOCdVBJiEaks",
    authDomain: "ebong-91ace.firebaseapp.com",
    projectId: "ebong-91ace",
    storageBucket: "ebong-91ace.firebasestorage.app",
    messagingSenderId: "779352810920",
    appId: "1:779352810920:web:57b532a4e3df04e9dbe99d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); // 🔴 Auth Initialize

window.allProductsList = []; // ⭐ NEW: Globally store products for CRM View
let posCart = []; // ⭐ NEW: Array to hold items for POS

// ==========================================
// 🔐 FIREBASE AUTHENTICATION LOGIC
// ==========================================

// চেক করবে ইউজার লগইন আছে কি না
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const adminDashboard = document.getElementById('admin-dashboard');

    if (user) {
        // লগইন থাকলে ড্যাশবোর্ড দেখাবে
        if(loginScreen) loginScreen.style.display = 'none';
        if(adminDashboard) adminDashboard.style.display = 'flex';
        
        // লগইন হওয়ার পরেই শুধু ডাটাগুলো লোড হবে
        loadAllData();
        initAdminLiveChat(); // ⭐ NEW: Initialize Admin Chat Listener
    } else {
        // লগইন না থাকলে লগইন স্ক্রিন দেখাবে
        if(loginScreen) loginScreen.style.display = 'flex';
        if(adminDashboard) adminDashboard.style.display = 'none';
    }
});

// লগইন ফর্ম সাবমিট
const loginForm = document.getElementById('adminLoginForm');
if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin_email').value;
        const pass = document.getElementById('admin_password').value;
        const btn = document.getElementById('login-btn');
        btn.innerText = "Logging in...";

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // লগইন সাকসেস হলে onAuthStateChanged অটোমেটিক ড্যাশবোর্ড শো করাবে
        } catch(err) {
            alert("Login Failed: Incorrect Email or Password!");
            console.error(err);
        } finally {
            btn.innerText = "Login";
        }
    });
}

// লগআউট বাটন
const logoutBtn = document.getElementById('logout-btn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if(confirm("Are you sure you want to logout?")) {
            signOut(auth);
        }
    });
}

// ==========================================
// সব ফাংশন একসাথে কল করার জন্য
// ==========================================
function loadAllData() {
    loadOrders(); 
    loadManageProducts(); 
    loadSettings(); 
    loadPaymentSettings(); 
    loadDeliveryAndPromos();
    loadActivityLogs();
    loadManageReviews();
    loadSpinSettings(); 
    loadCustomers(); // ⭐ NEW: Load Customer List
    populatePosProducts(); // ⭐ NEW: Load products into POS dropdown
    loadPosHistory(); // ⭐ NEW: Load POS Created History
    loadWalletRequests(); // ⭐ NEW: Load Wallet Deposit/Withdraw Requests
}

// ==========================================
// ⭐ NEW: Upload Image to Namecheap Hosting via PHP
// ==========================================
async function uploadImageToFirebase(fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append("file", file);

        // 🔴 আপনার আসল ডোমেইন নামটা এখানে দিন
        const apiUrl = "https://ebong.online/upload.php"; 

        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                body: formData
            });
            const result = await response.json();
            
            if (result.success) {
                return result.url; // Namecheap থেকে সরাসরি ছবির লিংক ফেরত আসবে!
            } else {
                console.error("Upload failed:", result.message);
                alert("Upload failed: " + result.message);
                return null;
            }
        } catch (error) {
            console.error("API error:", error);
            alert("Network error. Please check if your domain is correct.");
            return null;
        }
    }
    return null; // কোনো ছবি সিলেক্ট না করলে খালি ফেরত যাবে
}


// ==========================================
// 🔴 NEW: Activity Log Function (হিস্ট্রি সেভ করার ফাংশন)
// ==========================================
async function logAdminAction(adminName, actionType, orderId, note = "") {
    try {
        await addDoc(collection(db, "activity_logs"), {
            adminName: adminName,
            action: actionType,
            orderId: orderId,
            note: note,
            timestamp: new Date().toLocaleString()
        });
    } catch (error) {
        console.error("Log save error:", error);
    }
}

// ==========================================
// ⭐ NEW: Export Orders to Excel Function
// ==========================================
window.exportOrdersToExcel = async function() {
    try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        if (querySnapshot.empty) {
            alert("No orders to export!");
            return;
        }

        let excelData = [];
        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const trackingId = order.trackingId || docSnap.id;
            
            // Format Items nicely for Excel
            let itemsStr = order.items.map(i => `${i.name} (Code: ${i.code || 'N/A'}, Size: ${i.size || 'Standard'}, Color: ${i.color || 'Standard'}, Qty: ${i.qty})`).join(" | ");

            excelData.push({
                "Tracking ID": trackingId,
                "Date": order.date || 'N/A',
                "Customer Name": order.customerName,
                "Phone": order.phone,
                "Address": order.address,
                "Items": itemsStr,
                "Promo Used": order.promoCodeApplied !== "None" ? order.promoCodeApplied : "No",
                "Spin Prize": order.spinPrize !== "None" ? order.spinPrize : "No",
                "Delivery Charge": order.deliveryCharge || 0,
                "Total Discount (Tk)": order.discountReceived || 0,
                "Grand Total (Tk)": order.totalAmount,
                "Advance Paid (Tk)": order.advanceAmount || 0,
                "Payment Method": order.paymentMethod,
                "TrxID": order.trxId || 'N/A',
                "Payment Status": order.paymentStatus || (order.paymentMethod === 'COD' ? 'Due' : 'Paid'),
                "Order Status": order.status,
                "Admin Note": order.adminNote || 'N/A'
            });
        });

        // Use SheetJS to convert and download
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
        
        XLSX.writeFile(workbook, "eBong_Orders.xlsx");
        alert("✅ Excel file downloaded successfully!");

    } catch (error) {
        console.error("Export error:", error);
        alert("Failed to export to Excel: " + error.message);
    }
}

// ==========================================
// ⭐ NEW: Image Viewer Logic for Admin
// ==========================================
window.viewAdminImage = function(imageUrl, productName) {
    const modal = document.getElementById('image-viewer-modal');
    const imgEl = document.getElementById('viewer-img');
    const titleEl = document.getElementById('viewer-title');
    
    if(modal && imgEl && titleEl) {
        imgEl.src = imageUrl;
        titleEl.innerText = productName;
        modal.style.display = 'flex'; // Use flex to center
    }
}

// ==========================================
// 1. Load & Manage Orders (⭐ UPDATED REVENUE LOGIC)
// ==========================================
function loadOrders() {
    const tbody = document.getElementById('orders-table-body');
    if(!tbody) return;
    
    if(!document.getElementById('orderSearchInput')) {
        const tableElement = tbody.parentElement;
        const searchHtml = `<input type="text" id="orderSearchInput" onkeyup="searchOrders()" placeholder="🔍 Search by Tracking ID, Phone Number or Name..." style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px; font-size: 15px; box-sizing: border-box;">`;
        tableElement.insertAdjacentHTML('beforebegin', searchHtml);
    }

    // ⭐ Using onSnapshot for Real-time Order Updates
    onSnapshot(collection(db, "orders"), (querySnapshot) => {
        tbody.innerHTML = '';
        
        let totalRevenue = 0;
        let totalOrdersCount = 0;
        let pendingOrdersCount = 0;

        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No orders found.</td></tr>';
            if(document.getElementById('stat-revenue')) document.getElementById('stat-revenue').innerText = "Tk 0";
            if(document.getElementById('stat-total-orders')) document.getElementById('stat-total-orders').innerText = "0";
            if(document.getElementById('stat-pending')) document.getElementById('stat-pending').innerText = "0";
            return;
        }

        let ordersArray = [];
        querySnapshot.forEach(doc => ordersArray.push({ dbId: doc.id, ...doc.data() }));
        ordersArray.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first

        ordersArray.forEach((order) => {
            const trackingId = order.trackingId || order.dbId; 
            
            totalOrdersCount++;
            if (order.status === "Pending") pendingOrdersCount++;
            
            // ⭐ NEW: Revenue Logic (Only Delivered, Exclude Delivery Charge)
            if (order.status === "Delivered") {
                let productTotal = (Number(order.totalAmount) || 0) - (Number(order.deliveryCharge) || 0);
                if(productTotal < 0) productTotal = 0;
                totalRevenue += productTotal;
            }

            // Updated Payment Status display
            let payStatusText = "";
            let isPaid = false;
            
            if (order.paymentStatus === "Paid" || order.paymentStatus === "Full Paid") {
                payStatusText = "<span style='color:green; font-weight:bold;'>FULL PAID</span>";
                isPaid = true;
            } else if (order.paymentStatus === "Partial Paid" || order.paymentStatus === "Delivery Paid") {
                payStatusText = `<span style='color:blue; font-weight:bold;'>${order.paymentStatus} (Tk ${order.advanceAmount || 0})</span>`;
            } else {
                payStatusText = "<span style='color:red; font-weight:bold;'>DUE (COD)</span>";
            }

            // ⭐ UPDATED: Added "View Image" button in the item list
            const itemsList = order.items.map(i => {
                let pData = window.allProductsList.find(p => p.id === i.productId);
                let imgUrl = pData ? (pData.image_url || (pData.images && pData.images[0])) : '';
                let viewBtnHtml = imgUrl ? `<button class="action-btn" style="background:#17a2b8; font-size:10px; padding:2px 6px; margin-left:5px;" onclick="viewAdminImage('${imgUrl}', '${i.name}')">🖼️ View</button>` : '';

                return `• <b style="color:#d97d00;">[${i.code || 'N/A'}]</b> ${i.name} ${viewBtnHtml} <br> <span style="color:gray; font-size:12px;">Size: <b>${i.size || 'Standard'}</b> | Color: <b style="color:#0056b3;">${i.color || 'Standard'}</b></span> (Qty: ${i.qty})`;
            }).join('<br><br>');
            
            let statusColor = "#666";
            if (order.status === "Pending") statusColor = "orange";
            if (order.status === "Confirmed") statusColor = "#007bff";
            if (order.status === "Processing") statusColor = "#6f42c1";
            if (order.status === "Shipped") statusColor = "#17a2b8";
            if (order.status === "Out for Delivery") statusColor = "#e83e8c";
            if (order.status === "Delivered") statusColor = "#28a745";
            if (order.status === "Failed" || order.status === "Returned" || order.status === "Deleted") statusColor = "red";

            const promoHtml = order.discountReceived > 0 ? `<br><span style="color:green; font-weight:bold; font-size:12px;">Promo/Discount: -Tk ${order.discountReceived}</span>` : '';
            const spinHtml = order.spinPrize && order.spinPrize !== "None" ? `<br><span style="background: #ffe082; color:#d97d00; padding:2px 5px; border-radius:3px; font-weight:bold; font-size:11px;">🎁 Spin Prize: ${order.spinPrize}</span>` : '';
            const adminNoteHtml = order.adminNote ? `<div style="margin-top: 5px; background: #fff8e1; padding: 5px; border: 1px dashed orange; font-size: 11px; color: #d84315;">📝 Note: ${order.adminNote}</div>` : '';

            const orderDataString = encodeURIComponent(JSON.stringify(order));

            // ⭐ Status Dropdown Options (Added Failed & Returned)
            const statusOptions = ["Pending", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Failed", "Returned"];
            let dropdownHtml = `<select id="status_select_${order.dbId}" class="form-control" style="padding: 5px; font-size: 12px; margin-bottom: 5px;">`;
            statusOptions.forEach(opt => {
                let isSelected = order.status === opt ? "selected" : "";
                dropdownHtml += `<option value="${opt}" ${isSelected}>${opt}</option>`;
            });
            dropdownHtml += `</select>`;

            // Advanced Payment Update Dropdown
            let paymentDropdownHtml = `
                <div style="background: #f0f8ff; border: 1px solid #b3d4ff; padding: 8px; border-radius: 5px; margin-top: 5px;">
                    <label style="font-size:10px; font-weight:bold; color:#0056b3;">Update Payment:</label>
                    <select id="status_pay_${order.dbId}" class="form-control" style="padding: 4px; font-size: 11px; margin-bottom: 5px;" onchange="toggleUpdateAdvanceAmount('${order.dbId}')">
                        <option value="Due" ${order.paymentStatus === "Due" ? "selected" : ""}>Due</option>
                        <option value="Delivery Paid" ${order.paymentStatus === "Delivery Paid" ? "selected" : ""}>Delivery Paid</option>
                        <option value="Partial Paid" ${order.paymentStatus === "Partial Paid" ? "selected" : ""}>Partial Paid</option>
                        <option value="Full Paid" ${order.paymentStatus === "Full Paid" || order.paymentStatus === "Paid" ? "selected" : ""}>Full Paid</option>
                    </select>
                    <input type="number" id="update_adv_box_${order.dbId}" class="form-control" placeholder="Advance Amount (Tk)" value="${order.advanceAmount || 0}" style="padding: 4px; font-size: 11px; display: ${order.paymentStatus === 'Partial Paid' || order.paymentStatus === 'Delivery Paid' ? 'block' : 'none'}; margin-bottom: 5px;">
                </div>
            `;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>👤 ${order.customerName}</strong><br>
                    📞 <a href="tel:${order.phone}" style="color: blue;">${order.phone}</a><br>
                    📍 <small>${order.address}</small><br>
                    🕒 <small style="color: gray;">${order.date || 'N/A'}</small>
                </td>
                <td>
                    <small>${itemsList}</small>
                    ${promoHtml}
                    ${spinHtml}
                    <br><strong style="color: #d97d00; display: inline-block; margin-top: 5px;">Total: Tk ${order.totalAmount}</strong>
                    ${adminNoteHtml}
                </td>
                <td>
                    Tracking ID: <b style="background:#eee; padding:2px 5px; border-radius:3px; color: var(--brand-color);">${trackingId}</b><br><br>
                    <strong>💳 Method: ${order.paymentMethod}</strong><br>
                    <small>TrxID: <span style="color: #d97d00; font-weight: bold;">${order.trxId || 'N/A'}</span></small><br>
                    Status: ${payStatusText}
                    ${order.status !== "Deleted" ? paymentDropdownHtml : ''}
                </td>
                <td>
                    <b>Current: <span style="color: ${statusColor};">${order.status}</span></b><br>
                    
                    ${order.status !== "Deleted" ? `
                        <div style="background: #f9f9f9; border: 1px solid #ddd; padding: 10px; border-radius: 8px; margin-top: 5px;">
                            <label style="font-size:11px; font-weight:bold;">Update Status:</label>
                            ${dropdownHtml}
                            <input type="text" id="status_note_${order.dbId}" class="form-control" placeholder="Reason / Note (Optional)" style="padding: 5px; font-size: 11px; margin-bottom: 5px;">
                            <button class="action-btn btn-green" onclick="updateOrderStatus('${order.dbId}', '${trackingId}', '${order.status}')" style="width: 100%; font-size: 12px; padding: 8px;">🔄 Update</button>
                        </div>
                    ` : ''}

                    <button class="action-btn btn-blue" onclick="printInvoice('${orderDataString}', '${trackingId}')" style="margin-top: 10px; width: 100%;">🖨️ Print Invoice</button>
                    ${order.status !== "Deleted" ? `<button class="action-btn btn-red" onclick="deleteOrder('${order.dbId}')" style="width: 100%;">🗑️ Delete</button>` : ''}
                    ${order.status === "Deleted" ? `<div style="margin-top:10px; font-size:12px; background:#ffebeb; padding:5px; border-radius:5px; border:1px solid #ffcccc;"><b style="color:red;">Deleted By:</b> ${order.deletedBy || 'N/A'}<br><b style="color:red;">Reason:</b> ${order.deleteReason || 'N/A'}</div>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        if(document.getElementById('stat-revenue')) document.getElementById('stat-revenue').innerText = "Tk " + totalRevenue;
        if(document.getElementById('stat-total-orders')) document.getElementById('stat-total-orders').innerText = totalOrdersCount;
        if(document.getElementById('stat-pending')) document.getElementById('stat-pending').innerText = pendingOrdersCount;

    }, (error) => {
        console.error("Error loading live orders: ", error);
        tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center;">Error loading orders!</td></tr>';
    });
}
// ==========================================
// ⭐ NEW: Multiple Order Delete Logic
// ==========================================

// সব চেকবক্স একসাথে মার্ক বা আনমার্ক করার জন্য
window.toggleAllOrderCheckboxes = function() {
    const selectAllBtn = document.getElementById('selectAllOrders');
    const checkboxes = document.querySelectorAll('.main-order-cb');
    
    checkboxes.forEach(cb => {
        cb.checked = selectAllBtn.checked;
    });
}

// সিলেক্ট করা অর্ডারগুলো ডিলিট করার জন্য
window.deleteSelectedOrders = async function() {
    const selectedCheckboxes = document.querySelectorAll('.main-order-cb:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert("⚠️ Please select at least one order to delete!");
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${selectedCheckboxes.length} orders? This action cannot be undone!`)) {
        return;
    }

    try {
        const deletePromises = [];
        
        selectedCheckboxes.forEach(cb => {
            const orderId = cb.value;
            const docRef = doc(db, "orders", orderId); 
            deletePromises.push(deleteDoc(docRef));
        });

        await Promise.all(deletePromises);
        
        alert(`✅ ${selectedCheckboxes.length} orders deleted successfully!`);
        
        // ডিলিট হওয়ার পর Select All আনচেক করে দেওয়া
        document.getElementById('selectAllOrders').checked = false;

        // আপনার অর্ডার টেবিল আবার রিলোড করা
        loadOrders(); 
        
    } catch (error) {
        console.error("Error deleting orders:", error);
        alert("❌ Failed to delete orders: " + error.message);
    }
}

window.searchOrders = function() {
    let input = document.getElementById("orderSearchInput").value.toUpperCase();
    let table = document.getElementById("orders-table-body");
    let tr = table.getElementsByTagName("tr");

    for (let i = 0; i < tr.length; i++) {
        let textValue = tr[i].innerText.toUpperCase();
        if (textValue.indexOf(input) > -1) {
            tr[i].style.display = "";
        } else {
            tr[i].style.display = "none";
        }
    }
}

// ⭐ FIX: Added prepareAdminPDFInvoice globally to fix undefined error
window.prepareAdminPDFInvoice = function(order, trackingId, domainName) {
    let pdfAdminName = document.getElementById('pdf-admin-name');
    if(pdfAdminName) pdfAdminName.innerText = order.billedBy || 'Admin';

    let pdfTracking = document.getElementById('pdf-tracking-id');
    if(pdfTracking) pdfTracking.innerText = trackingId;

    let pdfDate = document.getElementById('pdf-date');
    if(pdfDate) pdfDate.innerText = order.date;

    let pdfName = document.getElementById('pdf-name');
    if(pdfName) pdfName.innerText = order.customerName;

    let pdfPhone = document.getElementById('pdf-phone');
    if(pdfPhone) pdfPhone.innerText = order.phone;

    let pdfAddr = document.getElementById('pdf-address');
    if(pdfAddr) pdfAddr.innerText = order.address;

    let pdfStatus = document.getElementById('pdf-order-status');
    if(pdfStatus) {
        pdfStatus.innerText = order.status;
        pdfStatus.style.color = order.status === 'Delivered' ? 'green' : (order.status === 'Deleted' ? 'red' : 'orange');
    }
    
    // Items
    let itemsHtml = '';
    if(order.items && Array.isArray(order.items)) {
        itemsHtml = order.items.map(i => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>${i.name}</strong><br>
                    <span style="font-size:12px; color:#666;">Code: ${i.code || 'N/A'} | Size: ${i.size || 'Standard'} | Color: ${i.color || 'Standard'}</span>
                </td>
                <td style="text-align:center; padding: 10px; border-bottom: 1px solid #eee;">${i.qty}</td>
                <td style="text-align:right; padding: 10px; border-bottom: 1px solid #eee;">Tk ${i.price * i.qty}</td>
            </tr>
        `).join('');
    }
    let pdfItems = document.getElementById('pdf-items');
    if(pdfItems) pdfItems.innerHTML = itemsHtml;
    
    // Pricing
    let discountVal = order.discountReceived || 0;
    let pdfDiscount = document.getElementById('pdf-discount');
    if(pdfDiscount) {
        if(discountVal > 0) pdfDiscount.innerText = `Discount: -Tk ${discountVal}`;
        else pdfDiscount.innerText = '';
    }

    let spinVal = order.spinPrize || "None";
    let pdfSpin = document.getElementById('pdf-spin');
    if(pdfSpin) {
        if(spinVal !== "None") pdfSpin.innerText = `🎁 Spin Prize: ${spinVal}`;
        else pdfSpin.innerText = '';
    }

    let pdfDel = document.getElementById('pdf-delivery');
    if(pdfDel) pdfDel.innerText = order.deliveryCharge || 0;

    let pdfTotal = document.getElementById('pdf-total');
    if(pdfTotal) pdfTotal.innerText = order.totalAmount || 0;

    let pdfMethod = document.getElementById('pdf-method');
    if(pdfMethod) pdfMethod.innerText = order.paymentMethod || 'COD';

    // Advanced Payment Math
    let payStatusText = order.paymentStatus || (order.paymentMethod === "COD" ? "Due" : "Paid");
    let advancePaid = parseInt(order.advanceAmount) || 0;
    let totalBill = parseInt(order.totalAmount) || 0;
    
    let cashToCollect = 0;
    if(payStatusText === "Paid" || payStatusText === "Full Paid") {
        cashToCollect = 0;
        advancePaid = totalBill;
        payStatusText = "FULL PAID";
    } else if (payStatusText === "Due") {
        cashToCollect = totalBill;
        advancePaid = 0;
        payStatusText = "DUE (COD)";
    } else {
        cashToCollect = totalBill - advancePaid;
        payStatusText = payStatusText.toUpperCase();
    }
    if (cashToCollect < 0) cashToCollect = 0;

    let pdfAdvPaid = document.getElementById('pdf-advance-paid');
    if(pdfAdvPaid) pdfAdvPaid.innerText = `Tk ${advancePaid}`;
    
    let pdfDueTotal = document.getElementById('pdf-due-total');
    if(pdfDueTotal) pdfDueTotal.innerText = cashToCollect;

    let watermark = document.getElementById('pdf-watermark');
    if (watermark) {
        watermark.innerText = cashToCollect === 0 ? 'PAID' : 'DUE';
        watermark.style.color = cashToCollect === 0 ? 'green' : 'red';
    }

    // Dynamic Domain
    let domEl = document.getElementById('pdf-dynamic-domain');
    if(domEl) domEl.innerText = domainName || 'www.ebong.com';

    // Show PDF Button Actions for POS
    const printBtn = document.getElementById('pos_print_btn');
    if(printBtn) {
        printBtn.onclick = function() {
            const element = document.getElementById('invoice-template');
            element.parentElement.style.display = 'block'; 
            html2pdf().from(element).save(`Invoice_${trackingId}.pdf`).then(() => {
                element.parentElement.style.display = 'none';
            });
        };
    }

    const picBtn = document.getElementById('pos_pic_btn');
    if(picBtn) {
        picBtn.onclick = function() {
            const element = document.getElementById('invoice-template');
            element.parentElement.style.display = 'block'; 
            // Fix text rendering before capturing
            element.style.fontFamily = "Arial, sans-serif"; 
            
            html2canvas(element, { scale: 2 }).then(canvas => {
                let link = document.createElement('a');
                link.download = `Invoice_${trackingId}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
                element.parentElement.style.display = 'none';
            });
        };
    }
}


// ⭐ UPDATED: PDF INVOICE GENERATION LOGIC WITH CORRECT SIZING AND CALCULATIONS
window.printInvoice = async function(orderData, trackingId) {
    const order = JSON.parse(decodeURIComponent(orderData));
    
    // Fetch Domain From Database dynamically
    let dynamicDomain = 'www.ebong.com';
    try {
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if(docSnap.exists() && docSnap.data().websiteDomain) {
            dynamicDomain = docSnap.data().websiteDomain;
        }
    } catch(e) {}

    // PDF Payment logic setup
    let payStatusText = order.paymentStatus || (order.paymentMethod === "COD" ? "Due" : "Paid");
    let advancePaid = parseInt(order.advanceAmount) || 0;
    let totalBill = parseInt(order.totalAmount) || 0;
    
    let cashToCollect = 0;
    if(payStatusText === "Paid" || payStatusText === "Full Paid") {
        cashToCollect = 0;
        advancePaid = totalBill;
        payStatusText = "FULL PAID";
    } else if (payStatusText === "Due") {
        cashToCollect = totalBill;
        advancePaid = 0;
        payStatusText = "DUE (COD)";
    } else {
        cashToCollect = totalBill - advancePaid;
        payStatusText = payStatusText.toUpperCase();
    }

    if (cashToCollect < 0) cashToCollect = 0;
    
    // ⭐ SHOW SIZE & COLOR ON INVOICE
    const itemsHtml = order.items.map(i => `
        <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 12px; text-align: left;">
                <strong>${i.name}</strong><br>
                <small style="color: #666;">Code: ${i.code || 'N/A'} | Size: <b>${i.size || 'Standard'}</b> | Color: <b style="color:#0056b3;">${i.color || 'Standard'}</b></small>
            </td>
            <td style="padding: 12px; text-align: center;">${i.qty}</td>
            <td style="padding: 12px; text-align: right;">Tk ${i.price * i.qty}</td>
        </tr>
    `).join('');

    const discountHtml = order.discountReceived > 0 
        ? `<p style="font-size: 16px; color: green; margin: 5px 0;">Discount: <b>-Tk ${order.discountReceived}</b></p>` 
        : '';

    // ⭐ Print Spin Prize on Invoice
    const spinHtml = order.spinPrize && order.spinPrize !== "None"
        ? `<p style="font-size: 16px; color: #d97d00; margin: 5px 0; font-weight: bold;">🎁 Lucky Spin Prize: ${order.spinPrize}</p>`
        : '';

    let adminNamePrint = order.billedBy || 'Online System';
    
    // A4 Size configuration
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
        <head>
            <title>Invoice - ${trackingId}</title>
            <style>
                @page { size: A4 portrait; margin: 0; }
                body { 
                    font-family: 'Arial', sans-serif; 
                    color: #222; 
                    margin: 0; 
                    padding: 0; 
                    box-sizing: border-box; 
                    width: 210mm; /* Exact A4 Width */
                    min-height: 297mm; /* Exact A4 Height */
                }
                .invoice-container { 
                    width: 100%; 
                    padding: 40px; 
                    position: relative;
                    box-sizing: border-box;
                }
                .header { display: flex; justify-content: space-between; border-bottom: 3px solid #d97d00; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { color: #d97d00; margin: 0; font-size: 42px; text-transform: uppercase; font-style: italic; font-weight: 900; letter-spacing: 1px; }
                .table-container { width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #ddd; }
                .table-container th { background: #f4f4f4; padding: 12px; border-bottom: 2px solid #ccc; text-transform: uppercase; font-size: 14px; }
                .totals { text-align: right; margin-top: 20px; }
                .footer { text-align: center; margin-top: 50px; font-size: 13px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
                .watermark { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); font-size: 150px; font-weight: bold; opacity: 0.1; color: ${cashToCollect === 0 ? 'green' : 'red'}; pointer-events: none; white-space: nowrap; z-index: -1;}
            </style>
        </head>
        <body>
            <div class="invoice-container">
                <div class="watermark">${cashToCollect === 0 ? 'PAID' : 'DUE'}</div>
                <div class="header">
                    <div>
                        <h1>eBong</h1>
                        <p style="margin: 5px 0; color: #555; font-size: 14px;">Premium Fashion Brand</p>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0 0 5px 0; font-size: 28px; letter-spacing: 2px;">INVOICE</h2>
                        <p style="margin: 2px 0; font-size: 14px;"><strong>Tracking ID:</strong> ${trackingId}</p>
                        <p style="margin: 2px 0; font-size: 14px;"><strong>Order Date:</strong> ${order.date || new Date().toLocaleString()}</p>
                        <p style="margin: 2px 0; font-size: 12px; color: gray;"><strong>Billed By:</strong> ${adminNamePrint}</p>
                    </div>
                </div>
                
                <div style="margin-bottom: 30px; display: flex; justify-content: space-between;">
                    <div>
                        <h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 10px; color: #d97d00;">Billed To:</h3>
                        <p style="margin: 3px 0; font-weight: bold; font-size: 18px;">${order.customerName}</p>
                        <p style="margin: 3px 0; font-size: 14px;">📞 ${order.phone}</p>
                        <p style="margin: 3px 0; font-size: 14px; max-width: 300px;">📍 ${order.address}</p>
                    </div>
                    <div style="text-align: right;">
                        <h3 style="border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 10px; color: #d97d00;">Order Status:</h3>
                        <p style="margin: 3px 0; font-weight: bold; font-size: 16px;">${order.status}</p>
                    </div>
                </div>
                
                <table class="table-container">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Product Details</th>
                            <th style="text-align: center;">Qty</th>
                            <th style="text-align: right;">Total Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px;">
                    <div style="width: 40%;">
                        <p style="font-weight: bold; font-size: 16px; margin-bottom: 5px; color: #111;">Payment Details:</p>
                        <div style="background: #f9f9f9; padding: 10px; border-radius: 5px; border: 1px solid #eee;">
                            <p style="margin: 0 0 5px 0; font-size: 13px;">Method: <strong>${order.paymentMethod}</strong></p>
                            <p style="margin: 0 0 5px 0; font-size: 13px;">Status: <strong>${payStatusText}</strong></p>
                            <p style="margin: 0; font-size: 13px; color: #d97d00;">Advance Paid: <strong>Tk ${advancePaid}</strong></p>
                        </div>
                    </div>
                    <div style="width: 60%; text-align: right;">
                        ${discountHtml}
                        ${spinHtml}
                        <p style="font-size: 14px; margin: 5px 0; border-bottom: 1px solid #eee; padding-bottom: 5px;">Delivery Charge: Tk ${order.deliveryCharge || 0}</p>
                        
                        <h3 style="margin: 10px 0 5px 0; color: #555; font-size: 18px;">Total Bill: Tk ${totalBill}</h3>
                        <h2 style="margin: 5px 0; color: #111; font-size: 26px; background: #ffebeb; display: inline-block; padding: 5px 15px; border-radius: 5px; border: 1px dashed red;">Cash to Collect: Tk ${cashToCollect}</h2>
                    </div>
                </div>
                
                <div class="footer">
                    <p style="margin: 5px 0; font-weight: bold; color: #555;">This is a system-generated invoice.</p>
                    <p style="margin: 5px 0;">Track your order status live at <b>${dynamicDomain}</b> using your Tracking ID.</p>
                </div>
            </div>
            <script>
                // Auto trigger print when loaded
                window.onload = function() { setTimeout(window.print, 500); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}


// ⭐ UPDATED: MULTI-STEP STATUS UPDATE WITH NOTE, STOCK DEDUCTION, RESTORE & AUTO CASHBACK
window.updateOrderStatus = async function(dbId, trackingId, oldStatus) {
    const statusSelect = document.getElementById(`status_select_${dbId}`);
    const paySelect = document.getElementById(`status_pay_${dbId}`);
    const advBox = document.getElementById(`update_adv_box_${dbId}`);
    const noteInput = document.getElementById(`status_note_${dbId}`);
    
    if(!statusSelect) return;
    
    const newStatus = statusSelect.value;
    const newPayStatus = paySelect ? paySelect.value : "";
    const advAmount = advBox ? parseInt(advBox.value) || 0 : 0;
    const noteText = noteInput ? noteInput.value.trim() : "";

    let adminName = localStorage.getItem('ebong_admin_name') || "";
    // Allow user to confirm or change their name
    adminName = prompt(`Enter/Confirm your Admin Name:`, adminName);
    if (!adminName || adminName.trim() === "") {
        alert("Name is required to update order!");
        return;
    }
    localStorage.setItem('ebong_admin_name', adminName.trim());

    if(confirm(`Are you sure you want to save these changes?`)) { 
        try {
            const orderRef = doc(db, "orders", dbId);
            const orderSnap = await getDoc(orderRef);
            let orderData = {};
            if (orderSnap.exists()) {
                orderData = orderSnap.data();
            }
            
            // ⭐ STOCK DEDUCT LOGIC (Only deduct if moving forward AND not deducted before)
            if ((newStatus === "Confirmed" || newStatus === "Processing" || newStatus === "Shipped" || newStatus === "Out for Delivery" || newStatus === "Delivered") && orderSnap.exists()) {
                if (!orderData.stockDeducted && orderData.items) {
                    for (let item of orderData.items) {
                        if (item.productId) { 
                            const pRef = doc(db, "products", item.productId);
                            const pSnap = await getDoc(pRef);
                            if (pSnap.exists()) {
                                let pData = pSnap.data();
                                let newSizes = pData.sizes || {};
                                
                                if (item.size && newSizes[item.size] !== undefined) {
                                    newSizes[item.size] = Math.max(0, newSizes[item.size] - item.qty);
                                }
                                let newStock = Math.max(0, pData.stock - item.qty);
                                await updateDoc(pRef, { stock: newStock, sizes: newSizes });
                            }
                        }
                    }
                    await updateDoc(orderRef, { stockDeducted: true });
                }
            }
            // ⭐ NEW: REFERRAL COMMISSION LOGIC (অর্ডার ডেলিভারি হলে অটোমেটিক টাকা দেওয়া)
            if (newStatus === "Delivered" && orderSnap.exists()) {
                if (!orderData.referralPaid) { // চেক করা যে আগে টাকা দেওয়া হয়েছে কি না
                    try {
                        const settingsSnap = await getDoc(doc(db, "settings", "general"));
                        const settings = settingsSnap.exists() ? settingsSnap.data() : {};
                        
                        // যদি রেফারেল অন থাকে এবং কমিশনের পরিমাণ 0 এর বেশি হয়
                        if (settings.referralStatus === 'on' && settings.referralCommission > 0) {
                            
                            // ১. যে অর্ডার করেছে, সেই কাস্টমারকে খুঁজে বের করা
                            let customerRefData = null;
                            let cId = orderData.userId || orderData.customerId || orderData.uid;
                            let cEmail = orderData.customerEmail || orderData.email;
                            
                            if (cId) {
                                let cSnap = await getDoc(doc(db, "customers", cId));
                                if(cSnap.exists()) customerRefData = cSnap.data();
                            } else if (cEmail) {
                                let cQuery = query(collection(db, "customers"), where("email", "==", cEmail));
                                let cQuerySnap = await getDocs(cQuery);
                                if(!cQuerySnap.empty) customerRefData = cQuerySnap.docs[0].data();
                            }
                            
                            // ২. যদি কাস্টমার কারো রেফারেল কোড দিয়ে এসে থাকে
                            if (customerRefData && customerRefData.referredBy) {
                                let refQuery = query(collection(db, "customers"), where("myReferralCode", "==", customerRefData.referredBy));
                                let refSnap = await getDocs(refQuery);
                                
                                // ৩. রেফারারকে খুঁজে তার একাউন্টে টাকা যোগ করে দেওয়া
                                if (!refSnap.empty) {
                                    let refDoc = refSnap.docs[0];
                                    let currentBalance = refDoc.data().walletBalance || 0;
                                    
                                    await updateDoc(doc(db, "customers", refDoc.id), {
                                        walletBalance: currentBalance + Number(settings.referralCommission)
                                    });
                                    
                                    // ৪. অর্ডারে সিল মেরে দেওয়া যে কমিশন দেওয়া শেষ (যাতে পরে আর ডাবল না যায়)
                                    await updateDoc(orderRef, { referralPaid: true });
                                    console.log("🎉 Referral Commission Sent to:", customerRefData.referredBy);
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Referral Bonus Error:", err);
                    }
                }
            }
            // ⭐ STOCK RESTORE LOGIC (If Failed or Returned, bring the stock back!)
            if ((newStatus === "Failed" || newStatus === "Returned") && orderSnap.exists()) {
                if (orderData.stockDeducted && orderData.items) {
                    for (let item of orderData.items) {
                        if (item.productId) {
                            const pRef = doc(db, "products", item.productId);
                            const pSnap = await getDoc(pRef);
                            if (pSnap.exists()) {
                                let pData = pSnap.data();
                                let newSizes = pData.sizes || {};
                                if (item.size && newSizes[item.size] !== undefined) {
                                    newSizes[item.size] = newSizes[item.size] + item.qty;
                                }
                                let newStock = pData.stock + item.qty;
                                await updateDoc(pRef, { stock: newStock, sizes: newSizes });
                            }
                        }
                    }
                    await updateDoc(orderRef, { stockDeducted: false }); // Reset so it can be deducted again if needed
                }
            }

            // ⭐ AUTO CASHBACK LOGIC (When Delivered)
            if (newStatus === "Delivered" && oldStatus !== "Delivered" && orderData.customerId && !orderData.cashbackGiven) {
                let totalCashback = 0;
                
                // Calculate cashback
                for (let item of orderData.items) {
                    if (item.productId) {
                        const pRef = doc(db, "products", item.productId);
                        const pSnap = await getDoc(pRef);
                        if (pSnap.exists()) {
                            let pData = pSnap.data();
                            if (pData.cashback && pData.cashback !== "0" && pData.cashback !== "") {
                                if (pData.cashback.includes('%')) {
                                    let percentage = parseFloat(pData.cashback.replace('%',''));
                                    if(!isNaN(percentage)) {
                                        totalCashback += Math.round((item.price * item.qty) * (percentage / 100));
                                    }
                                } else {
                                    let fixedAmt = parseFloat(pData.cashback);
                                    if(!isNaN(fixedAmt)) totalCashback += (fixedAmt * item.qty);
                                }
                            }
                        }
                    }
                }
                
                // Add to wallet if cashback exists
                if (totalCashback > 0) {
                    const cRef = doc(db, "customers", orderData.customerId);
                    const cSnap = await getDoc(cRef);
                    if (cSnap.exists()) {
                        let currentBalance = cSnap.data().walletBalance || 0;
                        await updateDoc(cRef, { walletBalance: currentBalance + totalCashback });
                        
                        await addDoc(collection(db, "customers", orderData.customerId, "wallet_history"), {
                            type: "Cashback Received", amount: totalCashback, status: "Completed", timestamp: new Date().getTime(), date: new Date().toLocaleString()
                        });
                        
                        await addDoc(collection(db, "customers", orderData.customerId, "notifications"), {
                            text: `🎉 Congratulations! Tk ${totalCashback} cashback added to your wallet for Order #${trackingId}.`, timestamp: new Date().getTime(), isRead: false
                        });
                        
                        await updateDoc(orderRef, { cashbackGiven: true, cashbackAmount: totalCashback });
                    }
                }
            }

            let updateData = { 
                status: newStatus,
                confirmedBy: adminName,
                confirmedAt: new Date().toLocaleString()
            };
            
            // Add payment data if changed
            if (newPayStatus) {
                updateData.paymentStatus = newPayStatus;
                updateData.advanceAmount = advAmount;
            }

            if (noteText !== "") {
                updateData.adminNote = noteText;
            }

            await updateDoc(orderRef, updateData); 
            
            let logMsg = `Status: ${newStatus} | Payment: ${newPayStatus} (Adv: ${advAmount}).`;
            if(noteText) logMsg += ` Note: ${noteText}`;
            
            await logAdminAction(adminName, `Order Updated`, trackingId, logMsg);
            
            // Success messages based on action
            if(newStatus === "Delivered") {
                alert(`✅ Order ${trackingId} is now marked as DELIVERED! Revenue and Cashback Updated.`);
            } else if(newStatus === "Failed" || newStatus === "Returned") {
                alert(`🔄 Order ${newStatus}! Stock has been successfully RESTORED.`);
            } else {
                alert(`✅ Order Updated Successfully!`);
            }

            if(noteInput) noteInput.value = ""; 
            
        } catch (e) { alert("Error: " + e.message); }
    }
}

window.deleteOrder = async function(id) {
    let adminName = localStorage.getItem('ebong_admin_name') || "";
    // Allow user to confirm or change their name
    adminName = prompt("Enter/Confirm your Admin Name to delete:", adminName);
    if (!adminName || adminName.trim() === "") {
        alert("Name is required to delete order!");
        return;
    }
    localStorage.setItem('ebong_admin_name', adminName.trim());

    const deleteReason = prompt("Enter reason for deletion (Optional):") || "No reason provided";

    if(confirm("⚠️ Are you sure you want to DELETE this order? (Stock will be restored)")) {
        try {
            // ⭐ STOCK RESTORE LOGIC (Before Deleting)
            const orderRef = doc(db, "orders", id);
            const orderSnap = await getDoc(orderRef);
            if(orderSnap.exists()) {
                let orderData = orderSnap.data();
                if (orderData.stockDeducted && orderData.items) {
                    for (let item of orderData.items) {
                        if (item.productId) {
                            const pRef = doc(db, "products", item.productId);
                            const pSnap = await getDoc(pRef);
                            if (pSnap.exists()) {
                                let pData = pSnap.data();
                                let newSizes = pData.sizes || {};
                                if (item.size && newSizes[item.size] !== undefined) {
                                    newSizes[item.size] = newSizes[item.size] + item.qty;
                                }
                                let newStock = pData.stock + item.qty;
                                await updateDoc(pRef, { stock: newStock, sizes: newSizes });
                            }
                        }
                    }
                    await updateDoc(orderRef, { stockDeducted: false });
                }
            }

            // Now update the status to Deleted
            await updateDoc(doc(db, "orders", id), {
                status: "Deleted",
                deletedBy: adminName,
                deleteReason: deleteReason,
                deletedAt: new Date().toLocaleString()
            });

            await logAdminAction(adminName, "Order Deleted", id, deleteReason);
            alert("🗑️ Order Deleted & Stock Restored Successfully!");
        } catch (e) { alert("Error: " + e.message); }
    }
}

// ==========================================
// ⭐ NEW: MANUAL ORDER ENTRY (MINI POS) LOGIC WITH DYNAMIC SIZE/COLOR
// ==========================================

function populatePosProducts() {
    const selectEl = document.getElementById('pos_product_select');
    if (!selectEl) return;
    
    // allProductsList is populated in loadManageProducts()
    let html = '<option value="">-- Select Product --</option>';
    window.allProductsList.forEach(p => {
        if (p.stock > 0) {
            html += `<option value="${p.id}" data-price="${p.discountPrice > 0 ? p.discountPrice : p.price}" data-name="${p.name}" data-code="${p.code || 'N/A'}">
                [Code: ${p.code || 'N/A'}] ${p.name} - Tk ${p.discountPrice > 0 ? p.discountPrice : p.price} (Stock: ${p.stock})
            </option>`;
        }
    });
    selectEl.innerHTML = html;
}

// ⭐ NEW: Auto Update Size and Color dropdown based on selected product
window.updatePosDropdowns = function() {
    const selectEl = document.getElementById('pos_product_select');
    const sizeSelect = document.getElementById('pos_product_size');
    const colorSelect = document.getElementById('pos_product_color');
    
    if(!selectEl || !sizeSelect || !colorSelect) return;

    sizeSelect.innerHTML = '<option value="">-- Select Size --</option>';
    colorSelect.innerHTML = '<option value="">-- Select Color --</option>';

    const productId = selectEl.value;
    if (!productId) return;

    const product = window.allProductsList.find(p => p.id === productId);
    if (!product) return;

    // Load Sizes
    if (product.sizes) {
        let hasSizes = false;
        for (let [sz, sqty] of Object.entries(product.sizes)) {
            if (sqty > 0) { // Only show sizes that are in stock
                sizeSelect.innerHTML += `<option value="${sz}">${sz} (Stock: ${sqty})</option>`;
                hasSizes = true;
            }
        }
        if(!hasSizes) sizeSelect.innerHTML = '<option value="Standard">Standard Size</option>';
    } else {
        sizeSelect.innerHTML = '<option value="Standard">Standard Size</option>';
    }

    // Load Colors
    if (product.colors && product.colors.trim() !== '') {
        let colorsArr = product.colors.split(',').map(c => c.trim());
        colorsArr.forEach(col => {
            if(col) colorSelect.innerHTML += `<option value="${col}">${col}</option>`;
        });
    } else {
        colorSelect.innerHTML = '<option value="Standard">Standard Color</option>';
    }
}

window.addPosItem = function() {
    const selectEl = document.getElementById('pos_product_select');
    const qtyEl = document.getElementById('pos_product_qty');
    const sizeEl = document.getElementById('pos_product_size');
    const colorEl = document.getElementById('pos_product_color');
    
    if (!selectEl || !selectEl.value) return alert("Please select a product first.");
    
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const productId = selectEl.value;
    const name = selectedOption.getAttribute('data-name');
    const code = selectedOption.getAttribute('data-code');
    const price = parseInt(selectedOption.getAttribute('data-price'));
    const qty = parseInt(qtyEl.value) || 1;
    
    // Get values from dropdown, fallback to text if input was changed to text
    const size = sizeEl.value.trim() || 'Standard';
    const color = colorEl.value.trim() || 'Standard';

    // Check if already in cart
    let existingItem = posCart.find(item => item.productId === productId && item.size === size && item.color === color);
    if(existingItem) {
        existingItem.qty += qty;
    } else {
        posCart.push({ productId, name, code, price, size, color, qty });
    }
    
    // Reset inputs
    qtyEl.value = 1;
    sizeEl.innerHTML = '<option value="">-- Select Size --</option>';
    colorEl.innerHTML = '<option value="">-- Select Color --</option>';
    selectEl.value = '';
    
    renderPosCart();
}

window.removePosItem = function(index) {
    posCart.splice(index, 1);
    renderPosCart();
}

function renderPosCart() {
    const container = document.getElementById('pos-cart-container');
    if (!container) return;

    let subtotal = 0;
    
    if (posCart.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: gray; font-size: 13px; margin: 0;">Cart is empty.</p>';
    } else {
        let html = '';
        posCart.forEach((item, index) => {
            let itemTotal = item.price * item.qty;
            subtotal += itemTotal;
            html += `
                <div class="pos-cart-item">
                    <div>
                        <strong>${item.name}</strong> <span style="color:gray; font-size:12px;">(x${item.qty})</span><br>
                        <small style="color:gray;">Code: ${item.code} | Sz: ${item.size} | Col: ${item.color} | @Tk ${item.price}</small>
                    </div>
                    <div style="text-align: right;">
                        <strong style="color: var(--brand-color);">Tk ${itemTotal}</strong><br>
                        <span onclick="removePosItem(${index})" style="color: red; font-size: 11px; cursor: pointer; text-decoration: underline;">Remove</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    // Calculations with Advanced Payment
    const delivery = parseInt(document.getElementById('pos_delivery_charge').value) || 0;
    const discount = parseInt(document.getElementById('pos_discount').value) || 0;
    let advancePaid = parseInt(document.getElementById('pos_advance_amount') ? document.getElementById('pos_advance_amount').value : 0) || 0;
    
    let grandTotal = subtotal + delivery - discount;
    if (grandTotal < 0) grandTotal = 0;
    
    let cashToCollect = grandTotal - advancePaid;
    if (cashToCollect < 0) cashToCollect = 0;

    document.getElementById('pos_subtotal').innerText = `Tk ${subtotal}`;
    document.getElementById('pos_delivery_display').innerText = `Tk ${delivery}`;
    document.getElementById('pos_discount_display').innerText = `-Tk ${discount}`;
    document.getElementById('pos_grand_total').innerText = `Tk ${grandTotal}`;
    
    // Extra elements for advance and due
    let advDisplay = document.getElementById('pos_advance_display');
    let dueDisplay = document.getElementById('pos_due_total');
    
    if(advDisplay) advDisplay.innerText = `-Tk ${advancePaid}`;
    if(dueDisplay) dueDisplay.innerText = `Tk ${cashToCollect}`;
}

// Update totals when typing in delivery/discount inputs
document.addEventListener('DOMContentLoaded', () => {
    const posDel = document.getElementById('pos_delivery_charge');
    const posDis = document.getElementById('pos_discount');
    if(posDel) posDel.addEventListener('input', renderPosCart);
    if(posDis) posDis.addEventListener('input', renderPosCart);
});

window.submitPosOrder = async function() {
    if (posCart.length === 0) return alert("Please add products to the cart first!");
    
    const name = document.getElementById('pos_c_name').value.trim();
    const phone = document.getElementById('pos_c_phone').value.trim();
    const address = document.getElementById('pos_c_address').value.trim();
    
    if (!name || !phone || !address) return alert("Please fill out all customer details.");

    let adminName = localStorage.getItem('ebong_admin_name') || "";
    adminName = prompt(`Enter/Confirm your Admin Name to create this invoice:`, adminName);
    if (!adminName || adminName.trim() === "") return;
    localStorage.setItem('ebong_admin_name', adminName.trim());

    const delivery = parseInt(document.getElementById('pos_delivery_charge').value) || 0;
    const discount = parseInt(document.getElementById('pos_discount').value) || 0;
    const payMethod = document.getElementById('pos_payment_method').value;
    const payStatus = document.getElementById('pos_payment_status').value;
    const advanceAmt = parseInt(document.getElementById('pos_advance_amount').value) || 0;
    const adminNote = document.getElementById('pos_admin_note').value.trim();
    
    let subtotal = posCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let grandTotal = subtotal + delivery - discount;
    if (grandTotal < 0) grandTotal = 0;
    
    let cashToCollect = grandTotal - advanceAmt;
    if(payStatus === "Full Paid") cashToCollect = 0;

    // Fetch Domain For DB directly
    let domainName = 'ebong.com';
    try {
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if(docSnap.exists() && docSnap.data().websiteDomain) {
            domainName = docSnap.data().websiteDomain;
        }
    } catch(e) {}

    // Generate Tracking ID
    let baseTrackingId = phone.length >= 5 ? phone.slice(-5) : Math.floor(10000 + Math.random() * 90000).toString();
    let finalTrackingId = baseTrackingId;
    
    try {
        const q = query(collection(db, "orders"), where("trackingIdBase", "==", baseTrackingId));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const count = querySnapshot.size;
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const suffix = alphabet[(count - 1) % 26]; 
            finalTrackingId = baseTrackingId + "-" + suffix;
        }

        let orderData = {
            trackingId: finalTrackingId,
            trackingIdBase: baseTrackingId,
            customerName: name,
            phone: phone,
            address: address,
            paymentMethod: payMethod,
            paymentStatus: payStatus,
            advanceAmount: advanceAmt,
            trxId: "Manual POS Entry",
            items: posCart, 
            promoCodeApplied: "Manual Discount", 
            discountReceived: discount, 
            spinPrize: "None",
            deliveryCharge: delivery,
            totalAmount: grandTotal, 
            status: "Confirmed", // Auto confirmed since admin is making it
            date: new Date().toLocaleString(),
            confirmedBy: adminName,
            confirmedAt: new Date().toLocaleString(),
            billedBy: adminName,
            adminNote: adminNote || "Created via Admin POS",
            stockDeducted: true, // We deduct stock right now
            isPosOrder: true // Mark as POS order for history
        };

        // Save Order
        await addDoc(collection(db, "orders"), orderData);

        // Deduct Stock immediately
        for (let item of posCart) {
            if (item.productId) { 
                const pRef = doc(db, "products", item.productId);
                const pSnap = await getDoc(pRef);
                if (pSnap.exists()) {
                    let pData = pSnap.data();
                    let newSizes = pData.sizes || {};
                    if (item.size && newSizes[item.size] !== undefined) {
                        newSizes[item.size] = Math.max(0, newSizes[item.size] - item.qty);
                    }
                    let newStock = Math.max(0, pData.stock - item.qty);
                    await updateDoc(pRef, { stock: newStock, sizes: newSizes });
                }
            }
        }

        await logAdminAction(adminName, `POS Order Created`, finalTrackingId, `Manual invoice generated`);

        // Prepare Success UI
        document.getElementById('pos_tracking_id_display').innerText = finalTrackingId;
        
        // ⭐ Generate WhatsApp Message WITH DYNAMIC DOMAIN
        let waMsg = `হ্যালো ${name}, ${domainName}-এ আপনার অর্ডারটি কনফার্ম হয়েছে! 🎉\n\n`;
        waMsg += `🛍️ *প্রোডাক্ট ডিটেইলস:*\n`;
        posCart.forEach(i => {
            waMsg += `- ${i.name} (Code: ${i.code} | Size: ${i.size} | Color: ${i.color}) - Qty: ${i.qty}\n`;
        });
        waMsg += `\n🚚 ডেলিভারি চার্জ: Tk ${delivery}\n`;
        if (discount > 0) waMsg += `🎁 ডিসকাউন্ট: -Tk ${discount}\n`;
        waMsg += `💰 *মোট বিল: Tk ${grandTotal}*\n`;
        if(advanceAmt > 0) waMsg += `✅ অ্যাডভান্স পেইড: Tk ${advanceAmt}\n`;
        waMsg += `📦 *ক্যাশ টু কালেক্ট (কুরিয়ারে দিতে হবে): Tk ${cashToCollect}*\n\n`;
        waMsg += `📍 *আপনার ট্র্যাকিং আইডি: ${finalTrackingId}*\n`;
        waMsg += `আমাদের ওয়েবসাইটে (${domainName}) গিয়ে 'Track Order' বক্সে এই আইডিটি দিয়ে আপনি আপনার পার্সেলের লাইভ আপডেট দেখতে পারবেন।\n\nধন্যবাদ! ❤️`;
        
        document.getElementById('pos_wa_message').value = waMsg;
        document.getElementById('pos-success-area').style.display = 'block';

        // Prepare Hidden PDF (Calling the fixed function)
        prepareAdminPDFInvoice(orderData, finalTrackingId, domainName);

        // Clear Form
        document.getElementById('pos_c_name').value = '';
        document.getElementById('pos_c_phone').value = '';
        document.getElementById('pos_c_address').value = '';
        document.getElementById('pos_admin_note').value = '';
        posCart = [];
        renderPosCart();
        
        alert("✅ Order generated successfully!");

    } catch(e) {
        alert("Error saving manual order: " + e.message);
    }
}

window.copyPosMessage = function() {
    const copyText = document.getElementById("pos_wa_message");
    copyText.select();
    copyText.setSelectionRange(0, 99999); // For mobile devices
    navigator.clipboard.writeText(copyText.value);
    alert("💬 Message copied to clipboard! You can now paste it in WhatsApp.");
}

// ⭐ NEW: POS HISTORY SECTION
function loadPosHistory() {
    // Add History UI below POS Section if not exists
    const posSection = document.getElementById('manualOrderEntry');
    if(!posSection) return;

    if(!document.getElementById('pos-history-container')) {
        const historyHtml = `
            <div id="pos-history-container" style="margin-top: 40px; border-top: 2px dashed #ccc; padding-top: 20px;">
                <h3 style="color: var(--brand-color);">📜 Recent POS Invoices</h3>
                <div class="table-wrapper">
                    <table>
                        <thead><tr><th>Invoice / Date</th><th>Customer</th><th>Amount</th><th>Action</th></tr></thead>
                        <tbody id="pos-history-table"><tr><td colspan="4" style="text-align:center;">Loading history...</td></tr></tbody>
                    </table>
                </div>
            </div>
        `;
        posSection.insertAdjacentHTML('beforeend', historyHtml);
    }

    const tbody = document.getElementById('pos-history-table');
    const q = query(collection(db, "orders"), where("isPosOrder", "==", true));

    onSnapshot(q, (querySnapshot) => {
        tbody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No POS invoices created yet.</td></tr>';
            return;
        }

        let ordersArray = [];
        querySnapshot.forEach(doc => ordersArray.push({ dbId: doc.id, ...doc.data() }));
        ordersArray.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort newest first

        ordersArray.forEach((order) => {
            const trackingId = order.trackingId || order.dbId;
            const orderDataString = encodeURIComponent(JSON.stringify(order));
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>ID: ${trackingId}</strong><br>
                    <small style="color:gray;">${order.date}</small><br>
                    <span style="color:${order.status === 'Deleted' ? 'red' : 'green'}; font-size:11px; font-weight:bold;">${order.status}</span>
                </td>
                <td>${order.customerName}<br><small>📞 ${order.phone}</small></td>
                <td><strong style="color:var(--brand-color);">Tk ${order.totalAmount}</strong></td>
                <td>
                    <button class="action-btn btn-blue" onclick="printInvoice('${orderDataString}', '${trackingId}')" style="font-size:11px; padding: 5px;">🖨️ Print</button>
                    ${order.status !== "Deleted" ? `<button class="action-btn btn-red" onclick="deleteOrder('${order.dbId}')" style="font-size:11px; padding: 5px;">🗑️ Delete</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}


// ==========================================
// 2. Manage Products Table (⭐ UPDATED TO ADVANCED EDIT)
// ==========================================
function loadManageProducts() {
    const tbody = document.getElementById('products-table-body');
    if(!tbody) return;

    onSnapshot(collection(db, "products"), (querySnapshot) => {
        tbody.innerHTML = '';
        let totalProductsCount = 0;
        window.allProductsList = []; // Update Global Product List 

        querySnapshot.forEach((docSnap) => {
            totalProductsCount++; 

            const p = docSnap.data(); const pId = docSnap.id;
            window.allProductsList.push({ id: pId, ...p }); 

            const stockColor = p.stock <= 0 ? "color:red; font-weight:bold;" : "color:green;";
            let sizeText = p.sizes ? `M:${p.sizes.M||0}, L:${p.sizes.L||0}, XL:${p.sizes.XL||0}, XXL:${p.sizes.XXL||0}, Free:${p.sizes.FreeSize||0}` : 'No sizes specified';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${p.name}</strong><br>
                    <small style="color:#d97d00; font-weight:bold;">Code: ${p.code || 'N/A'}</small><br>
                    <small>🎨 ${p.colors || 'N/A'}</small>
                </td>
                <td>${p.category}</td>
                <td style="${stockColor}">
                    <b>Total: ${p.stock <= 0 ? 'Out of Stock (0)' : p.stock}</b><br>
                    <small style="color:gray;">${sizeText}</small>
                </td>
                <td>Tk ${p.price} <br><small style="color:red;">Dis: Tk ${p.discountPrice || 0}</small></td>
                <td>
                    <button class="action-btn btn-blue" onclick="openAdvancedEditProduct('${pId}')" style="width:100%; margin-bottom:5px;">✏️ Advanced Edit</button>
                    <button class="action-btn btn-red" onclick="deleteProduct('${pId}')" style="width:100%;">🗑️ Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if(document.getElementById('stat-products')) document.getElementById('stat-products').innerText = totalProductsCount;
        populatePosProducts(); 
    }, (error) => {
        console.error("Error loading live products:", error);
    });
}

// ⭐ NEW: ADVANCED EDIT MODAL LOGIC
window.openAdvancedEditProduct = async function(productId) {
    const pData = window.allProductsList.find(p => p.id === productId);
    if(!pData) return alert("Product data not found!");

    document.getElementById('edit_p_id').value = productId;
    document.getElementById('edit_p_name').value = pData.name || '';
    document.getElementById('edit_p_code').value = pData.code || '';
    document.getElementById('edit_p_price').value = pData.price || 0;
    document.getElementById('edit_p_discount').value = pData.discountPrice || 0;
    if(document.getElementById('edit_p_cashback')) document.getElementById('edit_p_cashback').value = pData.cashback || "0";
    
    const catSelect = document.getElementById('edit_p_category');
    if(catSelect) catSelect.value = pData.category || 'women clothes';

    // Set Sizes
    if(pData.sizes) {
        document.getElementById('edit_s_m').value = pData.sizes.M || 0;
        document.getElementById('edit_s_l').value = pData.sizes.L || 0;
        document.getElementById('edit_s_xl').value = pData.sizes.XL || 0;
        document.getElementById('edit_s_xxl').value = pData.sizes.XXL || 0;
        document.getElementById('edit_s_free').value = pData.sizes.FreeSize || 0;
    } else {
        document.getElementById('edit_s_m').value = 0; document.getElementById('edit_s_l').value = 0;
        document.getElementById('edit_s_xl').value = 0; document.getElementById('edit_s_xxl').value = 0; document.getElementById('edit_s_free').value = 0;
    }

    // Set Images & Colors (Extract from Dictionary/Array)
    let images = pData.images || [];
    if(images.length === 0 && pData.image_url) images = [pData.image_url];
    
    // Convert old comma separated colors string to array
    let colors = [];
    if(pData.colors && pData.colors.trim() !== '') {
        colors = pData.colors.split(',').map(c => c.trim());
    }

    // Reset fields
    for(let i=1; i<=4; i++) {
        document.getElementById(`edit_img_url_${i}`).value = '';
        document.getElementById(`edit_img_color_${i}`).value = '';
        // Also clear file inputs
        const fileInput = document.getElementById(`edit_img_file_${i}`);
        if(fileInput) fileInput.value = '';
    }

    // Fill available fields
    for(let i=0; i < Math.min(images.length, 4); i++) {
        document.getElementById(`edit_img_url_${i+1}`).value = images[i] || '';
        document.getElementById(`edit_img_color_${i+1}`).value = colors[i] || '';
    }

    document.getElementById('edit-product-modal').style.display = 'block';
}

// Handle Advanced Edit Form Submit
const editProductForm = document.getElementById('editProductForm');
if(editProductForm) {
    editProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('update-product-btn'); 
        btn.innerText = "Updating..."; btn.disabled = true;

        const productId = document.getElementById('edit_p_id').value;

        // Calculate Stock
        const sm = parseInt(document.getElementById('edit_s_m').value) || 0;
        const sl = parseInt(document.getElementById('edit_s_l').value) || 0;
        const sxl = parseInt(document.getElementById('edit_s_xl').value) || 0;
        const sxxl = parseInt(document.getElementById('edit_s_xxl').value) || 0;
        const sfree = parseInt(document.getElementById('edit_s_free').value) || 0;
        
        const totalStockCalculated = sm + sl + sxl + sxxl + sfree;
        const sizesObj = { M: sm, L: sl, XL: sxl, XXL: sxxl, FreeSize: sfree };

        // Process Images & Colors (⭐ Check File Upload First, then fallback to URL)
        const img1 = await uploadImageToFirebase('edit_img_file_1') || document.getElementById('edit_img_url_1').value.trim();
        const col1 = document.getElementById('edit_img_color_1').value.trim();

        const img2 = await uploadImageToFirebase('edit_img_file_2') || document.getElementById('edit_img_url_2').value.trim();
        const col2 = document.getElementById('edit_img_color_2').value.trim();

        const img3 = await uploadImageToFirebase('edit_img_file_3') || document.getElementById('edit_img_url_3').value.trim();
        const col3 = document.getElementById('edit_img_color_3').value.trim();

        const img4 = await uploadImageToFirebase('edit_img_file_4') || document.getElementById('edit_img_url_4').value.trim();
        const col4 = document.getElementById('edit_img_color_4').value.trim();

        let imageArray = [img1, img2, img3, img4].filter(url => url !== '');
        let colorsArray = [col1, col2, col3, col4].filter(c => c !== '');
        let colorsString = colorsArray.join(', ');

        let colorImageMap = {};
        if(img1 && col1) colorImageMap[col1] = img1;
        if(img2 && col2) colorImageMap[col2] = img2;
        if(img3 && col3) colorImageMap[col3] = img3;
        if(img4 && col4) colorImageMap[col4] = img4;

        try {
            await updateDoc(doc(db, "products", productId), {
                name: document.getElementById('edit_p_name').value,
                code: document.getElementById('edit_p_code').value,
                category: document.getElementById('edit_p_category').value,
                price: Number(document.getElementById('edit_p_price').value),
                discountPrice: Number(document.getElementById('edit_p_discount').value),
                cashback: document.getElementById('edit_p_cashback') ? document.getElementById('edit_p_cashback').value.trim() : "0",
                
                stock: totalStockCalculated,
                sizes: sizesObj,
                
                colors: colorsString,
                colorImageMap: colorImageMap,
                
                image_url: imageArray.length > 0 ? imageArray[0] : "", 
                images: imageArray
            });
            
            alert("✅ Product Details Updated Successfully!");
            document.getElementById('edit-product-modal').style.display = 'none';
        } catch(err) {
            alert("Error updating product: " + err.message);
        } finally {
            btn.innerText = "💾 Update Product Details"; btn.disabled = false;
        }
    });
}

// ==========================================
// 3. Add New Product (WITH SIZES & IMAGE COLORS & FIREBASE STORAGE UPLOAD)
// ==========================================
const addProductForm = document.getElementById('addProductForm');
if(addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('product-submit-btn'); 
        btn.innerText = "Uploading (Please Wait)..."; btn.disabled = true;
        
        const codeInput = document.getElementById('p_code');
        const productCode = codeInput ? codeInput.value : 'N/A';

        // Calculate Total Stock from Sizes
        const sm = parseInt(document.getElementById('s_m').value) || 0;
        const sl = parseInt(document.getElementById('s_l').value) || 0;
        const sxl = parseInt(document.getElementById('s_xl').value) || 0;
        const sxxl = parseInt(document.getElementById('s_xxl').value) || 0;
        const sfree = parseInt(document.getElementById('s_free').value) || 0;
        
        const totalStockCalculated = sm + sl + sxl + sxxl + sfree;
        const sizesObj = { M: sm, L: sl, XL: sxl, XXL: sxxl, FreeSize: sfree };

        // Extract Image URLs and their Color mappings (⭐ Check File Upload First, then fallback to URL)
        const img1 = await uploadImageToFirebase('img_file_1') || document.getElementById('img_url_1').value.trim();
        const col1 = document.getElementById('img_color_1').value.trim();

        const img2 = await uploadImageToFirebase('img_file_2') || document.getElementById('img_url_2').value.trim();
        const col2 = document.getElementById('img_color_2').value.trim();

        const img3 = await uploadImageToFirebase('img_file_3') || document.getElementById('img_url_3').value.trim();
        const col3 = document.getElementById('img_color_3').value.trim();

        const img4 = await uploadImageToFirebase('img_file_4') || document.getElementById('img_url_4').value.trim();
        const col4 = document.getElementById('img_color_4').value.trim();

        let imageArray = [img1, img2, img3, img4].filter(url => url !== '');
        let colorsArray = [col1, col2, col3, col4].filter(c => c !== '');
        let colorsString = colorsArray.join(', ');

        let colorImageMap = {};
        if(img1 && col1) colorImageMap[col1] = img1;
        if(img2 && col2) colorImageMap[col2] = img2;
        if(img3 && col3) colorImageMap[col3] = img3;
        if(img4 && col4) colorImageMap[col4] = img4;

        try {
            await addDoc(collection(db, "products"), {
                name: document.getElementById('p_name').value,
                code: productCode, 
                category: document.getElementById('p_category').value,
                price: Number(document.getElementById('p_price').value),
                discountPrice: Number(document.getElementById('p_discount').value),
                cashback: document.getElementById('p_cashback') ? document.getElementById('p_cashback').value.trim() : "0",
                
                stock: totalStockCalculated, 
                sizes: sizesObj, 
                
                colors: colorsString, 
                colorImageMap: colorImageMap, 
                
                description: document.getElementById('p_desc').value,
                image_url: imageArray.length > 0 ? imageArray[0] : "", 
                images: imageArray, 
                timestamp: new Date()
            });
            
            alert("✅ Product Added Successfully!"); 
            document.getElementById('addProductForm').reset();
            
        } catch (error) { 
            alert("Error: " + error.message); 
        } finally {
            btn.innerText = "Upload Product"; btn.disabled = false;
        }
    });
}

window.deleteProduct = async function(id) {
    if(confirm("Are you sure you want to delete this product?")) {
        try {
            await deleteDoc(doc(db, "products", id));
            alert("🗑️ Product deleted successfully!");
        } catch (e) {
            alert("Error: " + e.message);
        }
    }
}

// ==========================================
// ⭐ Spin Wheel Settings Logic
// ==========================================
async function loadSpinSettings() {
    try {
        const docSnap = await getDoc(doc(db, "settings", "spin"));
        if(docSnap.exists()) {
            const data = docSnap.data();
            
            const toggleBtn = document.getElementById('spin_status_toggle');
            if(toggleBtn) toggleBtn.checked = data.enabled || false;

            if(document.getElementById('spin_tier_1')) document.getElementById('spin_tier_1').value = data.tier1 || '5% Discount';
            if(document.getElementById('spin_tier_2')) document.getElementById('spin_tier_2').value = data.tier2 || 'Free Delivery';
            if(document.getElementById('spin_tier_3')) document.getElementById('spin_tier_3').value = data.tier3 || '10% Discount';
            if(document.getElementById('spin_tier_4')) document.getElementById('spin_tier_4').value = data.tier4 || '12% Discount';
            if(document.getElementById('spin_tier_5')) document.getElementById('spin_tier_5').value = data.tier5 || 'Free Sunglass';
            if(document.getElementById('spin_tier_6')) document.getElementById('spin_tier_6').value = data.tier6 || '17% Discount';
        }
    } catch(e) { console.log(e); }
}

const spinSettingsForm = document.getElementById('spinSettingsForm');
if(spinSettingsForm) {
    spinSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('spin-submit-btn'); btn.innerText = "Saving...";
        
        try {
            await setDoc(doc(db, "settings", "spin"), {
                enabled: document.getElementById('spin_status_toggle').checked,
                tier1: document.getElementById('spin_tier_1').value,
                tier2: document.getElementById('spin_tier_2').value,
                tier3: document.getElementById('spin_tier_3').value,
                tier4: document.getElementById('spin_tier_4').value,
                tier5: document.getElementById('spin_tier_5').value,
                tier6: document.getElementById('spin_tier_6').value
            }, { merge: true });
            
            alert("✅ Spin Wheel Settings Saved Successfully!");
        } catch (error) {
            alert("Error: " + error.message);
        }
        btn.innerText = "Save Spin Settings";
    });
}

// ==========================================
// 4. Site Settings (⭐ UPDATED TO INCLUDE DOMAIN)
// ==========================================
async function loadSettings() {
    // Add safety check for the login screen error
    const loginScreen = document.getElementById('login-screen');
    if (loginScreen && loginScreen.style.display !== 'none' && !currentCustomer) return;

    try {
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if(docSnap.exists()) {
            const d = docSnap.data();
            if(document.getElementById('s_headline')) document.getElementById('s_headline').value = d.headline || '';
            
            // ⭐ NEW: Load Domain Name
            if(document.getElementById('s_domain_name')) document.getElementById('s_domain_name').value = d.websiteDomain || 'ebong.com'; 
            
            if(document.getElementById('s_banner_1')) document.getElementById('s_banner_1').value = d.bannerUrl || ''; 
            if(document.getElementById('s_banner_2')) document.getElementById('s_banner_2').value = d.bannerUrl_2 || '';
            if(document.getElementById('s_banner_3')) document.getElementById('s_banner_3').value = d.bannerUrl_3 || '';
            if(document.getElementById('s_banner_4')) document.getElementById('s_banner_4').value = d.bannerUrl_4 || '';
            if(document.getElementById('s_banner_5')) document.getElementById('s_banner_5').value = d.bannerUrl_5 || '';
            if(document.getElementById('s_banner_time')) document.getElementById('s_banner_time').value = d.bannerSlideTime || 3;
            
            if(document.getElementById('s_address')) document.getElementById('s_address').value = d.address || '';
            if(document.getElementById('s_phone')) document.getElementById('s_phone').value = d.phone || '';
            if(document.getElementById('s_email')) document.getElementById('s_email').value = d.email || '';
            if(document.getElementById('s_whatsapp')) document.getElementById('s_whatsapp').value = d.whatsapp || '';
            if(document.getElementById('s_messenger')) document.getElementById('s_messenger').value = d.messenger || '';
            // ⭐ NEW: Load Referral Settings
            if(document.getElementById('admin_referral_status')) document.getElementById('admin_referral_status').value = d.referralStatus || 'off';
            if(document.getElementById('admin_referral_commission')) document.getElementById('admin_referral_commission').value = d.referralCommission || '';
            if(document.getElementById('admin_welcome_bonus')) document.getElementById('admin_welcome_bonus').value = d.welcomeBonus || ''; 
            const popupToggle = document.getElementById('s_sales_popup_toggle');
            if(popupToggle) {
                popupToggle.checked = d.salesPopupEnabled !== undefined ? d.salesPopupEnabled : true;
            }
        }
    } catch(e) {}
}

const settingsForm = document.getElementById('settingsForm');
if(settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('settings-submit-btn'); 
        btn.innerText = "Uploading & Saving..."; 
        btn.disabled = true;

        try {
            // ⭐ NEW: Upload Banners if files are selected, else use URL input
            const banner1 = await uploadImageToFirebase('s_banner_file_1') || document.getElementById('s_banner_1').value;
            const banner2 = await uploadImageToFirebase('s_banner_file_2') || document.getElementById('s_banner_2').value;
            const banner3 = await uploadImageToFirebase('s_banner_file_3') || document.getElementById('s_banner_3').value;
            const banner4 = await uploadImageToFirebase('s_banner_file_4') || document.getElementById('s_banner_4').value;
            const banner5 = await uploadImageToFirebase('s_banner_file_5') || document.getElementById('s_banner_5').value;

            await setDoc(doc(db, "settings", "general"), {
                headline: document.getElementById('s_headline').value,
                websiteDomain: document.getElementById('s_domain_name') ? document.getElementById('s_domain_name').value : 'ebong.com',
                referralStatus: document.getElementById('admin_referral_status') ? document.getElementById('admin_referral_status').value : 'off',
                referralCommission: document.getElementById('admin_referral_commission') ? Number(document.getElementById('admin_referral_commission').value) : 0,
                welcomeBonus: document.getElementById('admin_welcome_bonus') ? Number(document.getElementById('admin_welcome_bonus').value) : 0,
                
                bannerUrl: banner1, 
                bannerUrl_2: banner2,
                bannerUrl_3: banner3,
                bannerUrl_4: banner4,
                bannerUrl_5: banner5,
                bannerSlideTime: parseInt(document.getElementById('s_banner_time').value) || 3,
                
                address: document.getElementById('s_address').value,
                phone: document.getElementById('s_phone').value,
                email: document.getElementById('s_email').value,
                whatsapp: document.getElementById('s_whatsapp').value,
                messenger: document.getElementById('s_messenger').value,
                salesPopupEnabled: document.getElementById('s_sales_popup_toggle').checked
            }, { merge: true });
            
            alert("✅ Settings, Domain, Banners & Contact Info Saved!");
            
            // Clear File Inputs after successful save
            for(let i=1; i<=5; i++) {
                if(document.getElementById(`s_banner_file_${i}`)) {
                    document.getElementById(`s_banner_file_${i}`).value = '';
                }
            }

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            btn.innerText = "Save Settings";
            btn.disabled = false;
        }
    });
}

// ==========================================
// 5. Payment Settings
// ==========================================
async function loadPaymentSettings() {
    try {
        const docSnap = await getDoc(doc(db, "settings", "payment"));
        if(docSnap.exists()) {
            if(document.getElementById('s_bkash')) document.getElementById('s_bkash').value = docSnap.data().bkash || '';
            if(document.getElementById('s_nagad')) document.getElementById('s_nagad').value = docSnap.data().nagad || '';
            if(document.getElementById('s_rocket')) document.getElementById('s_rocket').value = docSnap.data().rocket || '';
        }
    } catch(e) {}
}

const paymentForm = document.getElementById('paymentSettingsForm');
if(paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('payment-submit-btn'); btn.innerText = "Saving...";
        try {
            await setDoc(doc(db, "settings", "payment"), {
                bkash: document.getElementById('s_bkash').value,
                nagad: document.getElementById('s_nagad').value,
                rocket: document.getElementById('s_rocket').value
            }, { merge: true });
            alert("✅ Payment Numbers Saved!");
        } catch (error) {}
        btn.innerText = "Save Payment Numbers";
    });
}

// ==========================================
// 6. Delivery & Promo Settings
// ==========================================
async function loadDeliveryAndPromos() {
    try {
        const delSnap = await getDoc(doc(db, "settings", "delivery"));
        if(delSnap.exists()) {
            const data = delSnap.data();
            if(document.getElementById('d_inside')) document.getElementById('d_inside').value = data.inside || 60;
            if(document.getElementById('d_outside')) document.getElementById('d_outside').value = data.outside || 120;
            
            const freeThresh = document.getElementById('d_threshold');
            if(freeThresh) freeThresh.value = data.freeThreshold !== undefined ? data.freeThreshold : 3000;
            
            const autoFreeToggle = document.getElementById('d_auto_free_toggle');
            if(autoFreeToggle) autoFreeToggle.checked = data.autoFreeEnabled !== undefined ? data.autoFreeEnabled : false;
        }
    } catch(e) { console.log(e); }

    const tbody = document.getElementById('promo-table-body');
    if(!tbody) return;
    
    onSnapshot(collection(db, "promocodes"), (querySnapshot) => {
        if(querySnapshot.empty) { tbody.innerHTML = '<tr><td colspan="3">No active promos.</td></tr>'; return; }
        
        tbody.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            let data = docSnap.data();
            tbody.innerHTML += `
                <tr>
                    <td><strong>${docSnap.id}</strong></td>
                    <td>Tk ${data.discountAmount}</td>
                    <td><button class="action-btn btn-red" onclick="deletePromo('${docSnap.id}')">Remove</button></td>
                </tr>
            `;
        });
    });
}

const deliveryForm = document.getElementById('deliverySettingsForm');
if(deliveryForm) {
    deliveryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('delivery-submit-btn'); btn.innerText = "Saving...";
        try {
            await setDoc(doc(db, "settings", "delivery"), {
                inside: parseInt(document.getElementById('d_inside').value),
                outside: parseInt(document.getElementById('d_outside').value),
                freeThreshold: parseInt(document.getElementById('d_threshold').value || 0),
                autoFreeEnabled: document.getElementById('d_auto_free_toggle').checked 
            });
            alert("✅ Delivery Charges Saved!");
        } catch(e) { alert(e.message); }
        finally { btn.innerText = "Save Delivery Charges"; }
    });
}

const promoForm = document.getElementById('promoForm');
if(promoForm) {
    promoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('pr_code').value.trim().toUpperCase();
        const amount = parseInt(document.getElementById('pr_amount').value);
        const btn = document.getElementById('promo-submit-btn'); btn.innerText = "Adding...";
        try {
            await setDoc(doc(db, "promocodes", code), { discountAmount: amount });
            alert(`✅ Promo Code ${code} Added!`);
            document.getElementById('promoForm').reset();
        } catch(e) { alert(e.message); }
        finally { btn.innerText = "Add Promo Code"; }
    });
}

window.deletePromo = async (codeId) => {
    if(confirm(`Remove promo code ${codeId}?`)) {
        await deleteDoc(doc(db, "promocodes", codeId));
    }
};

// ==========================================
// 📜 Activity Log (⭐ UPDATED TO REAL-TIME ONSNAPSHOT)
// ==========================================
function loadActivityLogs() {
    const logBody = document.getElementById('activity-log-body');
    if(!logBody) return;
    
    const q = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (querySnapshot) => {
        logBody.innerHTML = '';

        if (querySnapshot.empty) {
            logBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No activity logs found.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.timestamp}</td>
                <td><strong>${data.adminName}</strong></td>
                <td>${data.action}</td>
                <td><small>${data.orderId}</small></td>
                <td>${data.note || '-'}</td>
                <td>
                    <button class="action-btn btn-red" onclick="permanentDeleteOrder('${data.orderId}', '${docSnap.id}')" style="font-size:10px; padding:5px;">🗑️ Permanent Delete</button>
                </td>
            `;
            logBody.appendChild(tr);
        });
    }, (error) => {
        console.error("Error loading live logs:", error);
    });
}

window.permanentDeleteOrder = async function(orderId, logId) {
    if(confirm("⚠️ সাবধান! এটি ডিলিট করলে ডাটাবেস থেকে অর্ডারটি চিরতরে মুছে যাবে এবং আর কখনো ফিরে পাওয়া যাবেবিধা নেই। আপনি কি নিশ্চিত?")) {
        try {
            await deleteDoc(doc(db, "orders", orderId));
            await deleteDoc(doc(db, "activity_logs", logId));
            alert("✅ Order Permanently Deleted from Database!");
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
}

// ==========================================
// 8. Manage Customer Reviews (⭐ UPDATED TO REAL-TIME ONSNAPSHOT)
// ==========================================
function loadManageReviews() {
    const tbody = document.getElementById('reviews-table-body');
    if(!tbody) return;
    
    onSnapshot(collection(db, "reviews"), (querySnapshot) => {
        tbody.innerHTML = '';
        
        if(querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No reviews found.</td></tr>';
            return;
        }

        let reviews = [];
        querySnapshot.forEach(docSnap => reviews.push({ id: docSnap.id, ...docSnap.data() }));
        reviews.reverse();

        reviews.forEach(r => {
            let stars = '⭐'.repeat(parseInt(r.rating || 0)) + '☆'.repeat(5 - parseInt(r.rating || 0));
            let statusHtml = r.status === "Approved" 
                ? `<span style="color:green; font-weight:bold;">Approved</span>` 
                : `<span style="color:orange; font-weight:bold;">Pending</span>`;
                
            let approveBtn = r.status !== "Approved" 
                ? `<button class="action-btn btn-green" onclick="approveReview('${r.id}')" style="margin-bottom:5px; width: 100%;">✅ Approve</button>` 
                : '';

            tbody.innerHTML += `
                <tr>
                    <td><strong>👤 ${r.name}</strong><br><small>🕒 ${r.date}</small></td>
                    <td><span style="color:#ffb800;">${stars}</span><br><small style="font-style: italic;">"${r.text}"</small></td>
                    <td>${statusHtml}</td>
                    <td>
                        ${approveBtn}
                        <button class="action-btn btn-red" onclick="deleteAdminReview('${r.id}')" style="width: 100%;">🗑️ Delete</button>
                    </td>
                </tr>
            `;
        });
    }, (error) => {
        console.error("Error loading live admin reviews:", error);
    });
}

window.approveReview = async function(id) {
    if(confirm("Are you sure you want to approve this review? It will be visible on the main website.")) {
        try {
            await updateDoc(doc(db, "reviews", id), { status: "Approved" });
            alert("✅ Review Approved successfully!");
        } catch(e) { alert("Error: " + e.message); }
    }
}

window.deleteAdminReview = async function(id) {
    if(confirm("⚠️ Are you sure you want to completely delete this review?")) {
        try {
            await deleteDoc(doc(db, "reviews", id));
            alert("🗑️ Review Deleted!");
        } catch(e) { alert("Error: " + e.message); }
    }
}


// ==========================================
// 💬 NEW: LIVE CHAT ADMIN LOGIC (WITH ADMIN NAME & CUSTOMER DETAILS)
// ==========================================
let activeChatId = null;
let chatUnsubscribe = null;

function initAdminLiveChat() {
    const chatListEl = document.getElementById('admin-chat-list');
    if (!chatListEl) return;

    // Listen to all active chats where status is not closed
    const chatsRef = collection(db, "live_chats");
    
    onSnapshot(chatsRef, (snapshot) => {
        let chatListHtml = '';
        let unreadTotal = 0;
        let hasActiveChats = false;

        snapshot.forEach((docSnap) => {
            const chatData = docSnap.data();
            const chatId = docSnap.id;
            
            // Only show active chats
            if (chatData.status !== "closed") {
                hasActiveChats = true;
                const lastMsg = chatData.messages && chatData.messages.length > 0 
                    ? chatData.messages[chatData.messages.length - 1] 
                    : { text: "No messages yet", sender: "System" };
                
                // Count unread (messages sent by user and not seen by admin)
                let unreadCount = 0;
                if(chatData.adminUnread && chatData.adminUnread > 0) {
                    unreadCount = chatData.adminUnread;
                    unreadTotal += unreadCount;
                }

                const isActive = activeChatId === chatId ? 'active' : '';
                const badgeHtml = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
                
                // Format time nicely
                let timeStr = "";
                if(lastMsg.timestamp) {
                    const dateObj = new Date(lastMsg.timestamp);
                    timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                }

                // Setup name and phone for the list
                let customerName = chatData.customerName || chatId.substring(0, 8);
                let customerPhone = chatData.customerPhone || '';

                chatListHtml += `
                    <div class="chat-user-item ${isActive}" onclick="openAdminChat('${chatId}')">
                        <div class="chat-user-info">
                            <h4>👤 ${customerName}</h4>
                            ${customerPhone ? `<small>📞 ${customerPhone}</small>` : ''}
                            <p>${lastMsg.sender === 'admin' ? 'You: ' : ''}${lastMsg.text}</p>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                            <span style="font-size: 10px; color: gray;">${timeStr}</span>
                            ${badgeHtml}
                        </div>
                    </div>
                `;
            }
        });

        if (!hasActiveChats) {
            chatListHtml = '<div style="padding: 20px; text-align: center; color: gray; font-size: 13px;">No active chats right now.</div>';
        }

        if(chatListEl) chatListEl.innerHTML = chatListHtml;

        // Update Notification Badge on Sidebar Menu
        const badgeEl = document.getElementById('admin-chat-badge');
        if (badgeEl) {
            if (unreadTotal > 0) {
                badgeEl.innerText = unreadTotal;
                badgeEl.style.display = 'inline-block';
            } else {
                badgeEl.style.display = 'none';
            }
        }
    });
}

window.openAdminChat = async function(chatId) {
    activeChatId = chatId;
    const windowEl = document.getElementById('admin-chat-window');
    
    // Clear previous listener if any
    if(chatUnsubscribe) chatUnsubscribe();

    // Mark as read immediately on click
    await updateDoc(doc(db, "live_chats", chatId), { adminUnread: 0 });

    if(windowEl) {
        windowEl.innerHTML = `
            <div class="chat-header">
                <span id="chat-header-title">👤 Loading...</span>
                <button class="action-btn btn-red" onclick="closeChatTicket('${chatId}')" style="margin: 0; font-size: 11px;">❌ End Chat</button>
            </div>
            <div class="chat-messages" id="admin-messages-box">
                <div style="text-align:center; color:gray; font-size:12px;">Loading messages...</div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="admin-chat-input" placeholder="Type a reply..." onkeypress="handleAdminChatEnter(event, '${chatId}')">
                <button onclick="sendAdminReply('${chatId}')">Send</button>
            </div>
        `;
    }

    // Listen to specific chat
    const chatRef = doc(db, "live_chats", chatId);
    chatUnsubscribe = onSnapshot(chatRef, (docSnap) => {
        if (docSnap.exists()) {
            const chatData = docSnap.data();
            
            // Update Header with Name & Phone
            const headerTitle = document.getElementById('chat-header-title');
            if(headerTitle) {
                headerTitle.innerText = `👤 ${chatData.customerName || 'Customer'} (${chatData.customerPhone || 'N/A'})`;
            }

            // If customer closed it while admin was watching
            if(chatData.status === "closed") {
                if(windowEl) {
                    windowEl.innerHTML = `
                        <div class="no-chat-selected">
                            <span style="font-size: 40px; margin-bottom: 10px;">🔒</span>
                            <p>This chat has been closed by the customer.</p>
                        </div>
                    `;
                }
                activeChatId = null;
                return;
            }

            const msgBox = document.getElementById('admin-messages-box');
            if (!msgBox) return;

            let msgsHtml = '';
            if (chatData.messages) {
                chatData.messages.forEach(msg => {
                    const isAdmin = msg.sender === 'admin';
                    const bubbleClass = isAdmin ? 'msg-admin' : 'msg-customer';
                    
                    let timeStr = "";
                    if(msg.timestamp) {
                        const d = new Date(msg.timestamp);
                        timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    }

                    // Display Sender Name inside bubble
                    let senderHtml = '';
                    if (isAdmin && msg.adminName) {
                        senderHtml = `<strong style="font-size:11px; display:block; margin-bottom:3px; color:#d1e8ff;">${msg.adminName} (Admin)</strong>`;
                    } else if (!isAdmin && chatData.customerName) {
                        senderHtml = `<strong style="font-size:11px; display:block; margin-bottom:3px; color:#007bff;">${chatData.customerName}</strong>`;
                    }

                    msgsHtml += `
                        <div class="msg-bubble ${bubbleClass}">
                            ${senderHtml}
                            ${msg.text}
                            <span class="msg-time">${timeStr}</span>
                        </div>
                    `;
                });
            }
            msgBox.innerHTML = msgsHtml;
            // Auto scroll to bottom
            msgBox.scrollTop = msgBox.scrollHeight;
        }
    });
}

window.sendAdminReply = async function(chatId) {
    const inputEl = document.getElementById('admin-chat-input');
    const text = inputEl.value.trim();
    if (!text) return;

    // Admin Identity Prompt Logic
    let adminName = localStorage.getItem('ebong_admin_name');
    if (!adminName) {
        adminName = prompt("Please enter your name (Support Agent Name) to reply:");
        if (!adminName || adminName.trim() === "") return; // Cannot reply without name
        localStorage.setItem('ebong_admin_name', adminName.trim());
    }

    inputEl.value = ''; // clear input

    const chatRef = doc(db, "live_chats", chatId);
    const chatSnap = await getDoc(chatRef);
    
    if (chatSnap.exists()) {
        let messages = chatSnap.data().messages || [];
        messages.push({
            sender: "admin",
            adminName: adminName, 
            text: text,
            timestamp: new Date().getTime()
        });

        // Update database 
        await updateDoc(chatRef, { 
            messages: messages,
            userUnread: (chatSnap.data().userUnread || 0) + 1,
            lastUpdated: new Date().getTime()
        });
    }
}

window.handleAdminChatEnter = function(event, chatId) {
    if (event.key === 'Enter') {
        sendAdminReply(chatId);
    }
}

window.closeChatTicket = async function(chatId) {
    if(confirm("Are you sure you want to end this chat? The customer will no longer be able to reply here.")) {
        try {
            await updateDoc(doc(db, "live_chats", chatId), { 
                status: "closed",
                closedBy: "Admin",
                closedAt: new Date().getTime()
            });
            
            const windowEl = document.getElementById('admin-chat-window');
            if(windowEl) {
                windowEl.innerHTML = `
                    <div class="no-chat-selected">
                        <span style="font-size: 40px; margin-bottom: 10px;">✅</span>
                        <p>Chat closed successfully.</p>
                    </div>
                `;
            }
            activeChatId = null;
        } catch(e) {
            alert("Error closing chat: " + e.message);
        }
    }
}

// Function to clean up old/all chats
window.clearAllChats = async function() {
    if(confirm("⚠️ WARNING: This will permanently delete ALL chat history from the database. Are you sure?")) {
        try {
            const querySnapshot = await getDocs(collection(db, "live_chats"));
            querySnapshot.forEach(async (docSnap) => {
                await deleteDoc(doc(db, "live_chats", docSnap.id));
            });
            alert("✅ All chats have been cleared!");
            const windowEl = document.getElementById('admin-chat-window');
            if(windowEl) {
                windowEl.innerHTML = `
                    <div class="no-chat-selected">
                        <span style="font-size: 40px; margin-bottom: 10px;">🧹</span>
                        <p>All chats cleared.</p>
                    </div>
                `;
            }
            activeChatId = null;
        } catch (e) {
            alert("Error: " + e.message);
        }
    }
}

// ==========================================
// ⭐ NEW: CUSTOMER CRM SYSTEM (Load & View)
// ==========================================

function loadCustomers() {
    const tbody = document.getElementById('customers-table-body');
    if(!tbody) return;

    onSnapshot(collection(db, "customers"), (querySnapshot) => {
        tbody.innerHTML = '';
        
        if (querySnapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No registered customers found.</td></tr>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const customer = docSnap.data();
            const customerId = docSnap.id;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${customer.name || 'N/A'}</strong><br>
                    <small style="color: gray;">ID: ${customerId.substring(0,6)}</small>
                </td>
                <td>
                    📞 ${customer.phone || 'N/A'}<br>
                    📧 <small>${customer.email || 'N/A'}</small>
                </td>
                <td>${customer.createdAt || 'Unknown'}</td>
                <td>
                    <button class="action-btn btn-blue" onclick="viewCustomerDetails('${customerId}', '${customer.name}', '${customer.email}')">👁️ View</button>
                    <button class="action-btn btn-red" onclick="deleteCustomer('${customerId}')">🗑️ Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }, (error) => {
        console.error("Error loading live customers: ", error);
        tbody.innerHTML = '<tr><td colspan="4" style="color:red; text-align:center;">Error loading customers!</td></tr>';
    });
}

window.searchCustomers = function() {
    let input = document.getElementById("customerSearchInput").value.toUpperCase();
    let table = document.getElementById("customers-table-body");
    let tr = table.getElementsByTagName("tr");

    for (let i = 0; i < tr.length; i++) {
        let textValue = tr[i].innerText.toUpperCase();
        if (textValue.indexOf(input) > -1) {
            tr[i].style.display = "";
        } else {
            tr[i].style.display = "none";
        }
    }
}

window.viewCustomerDetails = async function(customerId, customerName, customerEmail) {
    const modal = document.getElementById('crm-modal');
    if(document.getElementById('crm-customer-name')) document.getElementById('crm-customer-name').innerText = `👤 ${customerName}`;
    if(document.getElementById('crm-current-user-id')) document.getElementById('crm-current-user-id').value = customerId;
    
    const ordersList = document.getElementById('crm-orders-list');
    const addrList = document.getElementById('crm-address-list');
    
    if(ordersList) ordersList.innerHTML = '<p style="text-align: center; color: gray; padding: 20px;">Loading order history...</p>';
    if(addrList) addrList.innerHTML = '<p style="text-align: center; color: gray; padding: 10px;">Loading addresses...</p>';
    
    if(modal) modal.style.display = 'block';

    try {
        // 1. Fetch Orders
        const q = query(collection(db, "orders"), where("customerId", "==", customerId));
        const querySnapshot = await getDocs(q);
        
        let totalOrders = 0;
        let totalSpent = 0;
        let html = '';

        if (querySnapshot.empty) {
            html = '<p style="text-align: center; color: gray; padding: 20px;">No orders found for this customer.</p>';
        } else {
            let ordersArray = [];
            querySnapshot.forEach((docSnap) => {
                ordersArray.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Sort by Date (Newest first)
            ordersArray.sort((a, b) => new Date(b.date) - new Date(a.date));

            ordersArray.forEach(order => {
                totalOrders++;
                if(order.status !== 'Deleted') {
                    totalSpent += Number(order.totalAmount) || 0;
                }

                let itemsStr = order.items.map(i => `${i.name} (Qty: ${i.qty})`).join("<br>");
                let statusColor = order.status === 'Confirmed' ? '#28a745' : (order.status === 'Deleted' ? '#dc3545' : '#ff9800');

                html += `
                    <div class="history-card">
                        <div class="history-header">
                            <strong>Order #${order.id.substring(0,8)}</strong>
                            <span style="color: white; background: ${statusColor}; padding: 3px 8px; border-radius: 4px; font-weight: bold;">${order.status}</span>
                        </div>
                        <p style="margin: 0 0 10px 0; font-size: 13px;">${itemsStr}</p>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #eee; padding-top: 10px;">
                            <small style="color: gray;">${order.date}</small>
                            <strong style="color: #d97d00; font-size: 16px;">Tk ${order.totalAmount}</strong>
                        </div>
                    </div>
                `;
            });
        }

        // Update Stats
        if(document.getElementById('crm-total-orders')) document.getElementById('crm-total-orders').innerText = totalOrders;
        if(document.getElementById('crm-total-spent')) document.getElementById('crm-total-spent').innerText = `Tk ${totalSpent}`;
        if(ordersList) ordersList.innerHTML = html;

        // 2. Fetch Joined Date
        const cDoc = await getDoc(doc(db, "customers", customerId));
        if(cDoc.exists() && document.getElementById('crm-joined-date')) {
            document.getElementById('crm-joined-date').innerText = cDoc.data().createdAt || 'N/A';
        }

        // ⭐ 3. Fetch Saved Addresses
        const addrSnapshot = await getDocs(collection(db, "customers", customerId, "addresses"));
        let addrHtml = '';
        if(addrSnapshot.empty) {
            addrHtml = '<p style="color: gray; font-size: 13px;">No addresses saved.</p>';
        } else {
            addrSnapshot.forEach((aDoc) => {
                const aData = aDoc.data();
                addrHtml += `
                    <div class="admin-addr-card">
                        <h5>${aData.title} ${aData.isDefault ? '<span style="color:green;">[Default]</span>' : ''}</h5>
                        <p style="margin:0; color:#555;">${aData.details}</p>
                    </div>
                `;
            });
        }
        if(addrList) addrList.innerHTML = addrHtml;

        // ⭐ 4. NEW: Fetch Wishlist
        const wishSnapshot = await getDocs(collection(db, "customers", customerId, "wishlist"));
        let wishHtml = '<h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 20px;">❤️ Wishlist</h3><div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px; margin-bottom: 20px;">';
        
        if(wishSnapshot.empty) {
            wishHtml += '<p style="color: gray; font-size: 13px;">No items in wishlist.</p>';
        } else {
            wishSnapshot.forEach((wDoc) => {
                const pid = wDoc.id;
                const pData = window.allProductsList ? window.allProductsList.find(p => p.id === pid) : null;
                if(pData) {
                    let imgUrl = pData.image_url || (pData.images && pData.images[0]) || '';
                    if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) imgUrl = 'data:image/jpeg;base64,' + imgUrl;
                    
                    wishHtml += `
                        <div style="min-width: 120px; max-width: 120px; background: #fff; border: 1px solid #ddd; padding: 10px; border-radius: 8px; text-align: center; flex-shrink: 0;">
                            <img src="${imgUrl}" style="width: 100%; height: 60px; object-fit: contain; border-radius: 4px; margin-bottom: 5px;" onerror="this.style.display='none'">
                            <p style="font-size: 11px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${pData.name}">${pData.name}</p>
                        </div>
                    `;
                } else {
                    wishHtml += `<div style="min-width: 100px; background: #eee; padding: 10px; border-radius: 8px; font-size: 11px;">Item ID: ${pid.substring(0,5)}...</div>`;
                }
            });
        }
        wishHtml += '</div>';

        // Clean up old wishlist div if opened another customer previously
        let oldWishDiv = document.getElementById('crm-wishlist-container');
        if(oldWishDiv) oldWishDiv.remove();

        // Create new div and insert it after addresses
        let newWishDiv = document.createElement('div');
        newWishDiv.id = 'crm-wishlist-container';
        newWishDiv.innerHTML = wishHtml;
        if(addrList) addrList.parentNode.insertBefore(newWishDiv, ordersList.previousElementSibling);

    } catch (error) {
        console.error("Error loading customer history:", error);
        if(ordersList) ordersList.innerHTML = '<p style="text-align: center; color: red;">Failed to load data.</p>';
    }
}

// ⭐ Send Direct Notification to Customer
window.sendDirectNotification = async function() {
    const customerIdEl = document.getElementById('crm-current-user-id');
    const textInput = document.getElementById('crm-notify-text');
    
    if(!customerIdEl || !textInput) return;
    
    const customerId = customerIdEl.value;
    const msg = textInput.value.trim();

    if(!msg) {
        alert("Please type a message first.");
        return;
    }

    try {
        await updateDoc(doc(db, "customers", customerId), {
            adminNotification: msg
        });
        alert("✅ Notification sent to customer!");
        textInput.value = ''; // clear input
    } catch(e) {
        alert("Error sending notification: " + e.message);
    }
}

window.deleteCustomer = async function(customerId) {
    if(confirm("⚠️ ARE YOU SURE? This will permanently delete the customer's account and they won't be able to login anymore. Order history will remain intact but disconnected.")) {
        try {
            await deleteDoc(doc(db, "customers", customerId));
            alert("🗑️ Customer Profile Deleted Successfully!");
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
}

// ==========================================
// ⭐ NEW: ADMIN WALLET MANAGEMENT LOGIC
// ==========================================

// Search User
window.searchUserForWallet = async function() {
    const input = document.getElementById('wallet_search_user').value.trim();
    if(!input) return alert("Please enter Email or Phone number to search.");

    let userFound = null;
    let userId = null;

    try {
        // Search by Phone
        let q = query(collection(db, "customers"), where("phone", "==", input));
        let snap = await getDocs(q);
        
        if (snap.empty) {
            // Search by Email if phone not found
            q = query(collection(db, "customers"), where("email", "==", input));
            snap = await getDocs(q);
        }

        if (snap.empty) {
            alert("❌ No customer found with this Phone or Email.");
            document.getElementById('wallet_user_details').style.display = 'none';
            return;
        }

        snap.forEach(doc => {
            userFound = doc.data();
            userId = doc.id;
        });

        if (userFound) {
            document.getElementById('w_u_name').innerText = userFound.name || 'Unknown';
            document.getElementById('w_u_email').innerText = userFound.email || 'N/A';
            document.getElementById('w_u_balance').innerText = `Tk ${userFound.walletBalance || 0}`;
            document.getElementById('w_u_uid').value = userId;
            
            document.getElementById('wallet_user_details').style.display = 'block';
        }

    } catch (e) {
        console.error("Wallet Search Error:", e);
        alert("System error while searching.");
    }
}

// Update Manual Wallet Balance
window.updateUserWallet = async function(actionType) {
    const uid = document.getElementById('w_u_uid').value;
    const amountInput = document.getElementById('wallet_amount_input').value;
    const amount = parseInt(amountInput);

    if(!uid) return alert("User not selected.");
    if(isNaN(amount) || amount <= 0) return alert("Please enter a valid amount.");

    let confirmMsg = actionType === 'add' ? `Are you sure you want to ADD Tk ${amount} to this user?` : `Are you sure you want to DEDUCT Tk ${amount} from this user?`;
    
    if(confirm(confirmMsg)) {
        try {
            const userRef = doc(db, "customers", uid);
            const userSnap = await getDoc(userRef);
            
            if(userSnap.exists()) {
                let currentBalance = userSnap.data().walletBalance || 0;
                let newBalance = actionType === 'add' ? currentBalance + amount : currentBalance - amount;
                
                if(newBalance < 0) return alert("Error: User balance cannot be negative.");

                await updateDoc(userRef, { walletBalance: newBalance });
                
                // Track History
                let historyType = actionType === 'add' ? 'Manual Deposit (Admin)' : 'Manual Deduct (Admin)';
                await addDoc(collection(db, "customers", uid, "wallet_history"), {
                    type: historyType,
                    amount: amount,
                    status: "Completed",
                    timestamp: new Date().getTime(),
                    date: new Date().toLocaleString()
                });

                // Update UI instantly
                document.getElementById('w_u_balance').innerText = `Tk ${newBalance}`;
                document.getElementById('wallet_amount_input').value = '';
                
                // Send auto notification to user
                let notiMsg = actionType === 'add' ? `🎉 Congratulations! Admin has added Tk ${amount} to your wallet.` : `⚠️ Tk ${amount} has been deducted from your wallet by Admin.`;
                
                await addDoc(collection(db, "customers", uid, "notifications"), {
                    text: notiMsg,
                    timestamp: new Date().getTime(),
                    isRead: false
                });

                // Update notification trigger
                await updateDoc(userRef, { adminNotification: notiMsg });
                
                alert(`✅ Wallet Updated Successfully! New Balance: Tk ${newBalance}`);
            }
        } catch(e) {
            console.error(e);
            alert("Failed to update wallet.");
        }
    }
}

// ⭐ PIN Reset function
window.resetCustomerPIN = async function() {
    const uid = document.getElementById('w_u_uid').value;
    if(!uid) return alert("User not selected.");

    if(confirm("⚠️ Are you sure you want to RESET the PIN for this customer? They will be asked to set a new PIN next time.")) {
        try {
            await updateDoc(doc(db, "customers", uid), {
                walletPin: null // Reset to null
            });
            alert("✅ PIN has been successfully reset!");
        } catch(e) {
            console.error(e);
            alert("Failed to reset PIN.");
        }
    }
}

// ⭐ Load Pending Wallet Requests
function loadWalletRequests() {
    const tbody = document.getElementById('wallet-requests-table');
    if(!tbody) return;

    const q = query(collection(db, "wallet_requests"), where("status", "==", "Pending"));
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: gray;">No pending requests.</td></tr>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const reqId = docSnap.id;
            
            let color = data.type === 'Deposit' ? 'green' : 'red';
            let icon = data.type === 'Deposit' ? '📥' : '📤';

            let extraInfo = data.type === 'Deposit' 
                ? `TrxID: <b style="color:#d97d00;">${data.trxId}</b>` 
                : `Send to: <b style="color:#007bff;">${data.withdrawPhone}</b>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${data.customerName}</strong><br>
                    <small>📞 ${data.customerPhone}</small>
                </td>
                <td>
                    <span style="background:#eee; padding:2px 6px; border-radius:4px; font-weight:bold; color:${color};">${icon} ${data.type} via ${data.method}</span><br>
                    <small style="margin-top:5px; display:inline-block;">${extraInfo}</small><br>
                    <small style="color:gray;">${data.date}</small>
                </td>
                <td><strong style="color:${color}; font-size:15px;">Tk ${data.amount}</strong></td>
                <td>
                    <button class="action-btn btn-green" onclick="handleWalletRequest('${reqId}', '${data.customerId}', '${data.type}', ${data.amount}, 'Approve')" style="width:100%; margin-bottom:5px;">✅ Approve</button>
                    <button class="action-btn btn-red" onclick="handleWalletRequest('${reqId}', '${data.customerId}', '${data.type}', ${data.amount}, 'Reject')" style="width:100%;">❌ Reject</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// Handle Approve / Reject
window.handleWalletRequest = async function(reqId, customerId, type, amount, action) {
    let confirmMsg = `Are you sure you want to ${action.toUpperCase()} this ${type} request for Tk ${amount}?`;
    
    if (confirm(confirmMsg)) {
        try {
            const userRef = doc(db, "customers", customerId);
            const reqRef = doc(db, "wallet_requests", reqId);
            
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) return alert("Error: Customer not found.");
            
            let currentBalance = userSnap.data().walletBalance || 0;
            let newBalance = currentBalance;
            let notiMsg = "";

            if (action === "Approve") {
                if (type === "Deposit") {
                    newBalance = currentBalance + amount;
                    notiMsg = `🎉 Your deposit request of Tk ${amount} has been APPROVED!`;
                    
                    // Add history
                    await addDoc(collection(db, "customers", customerId, "wallet_history"), {
                        type: "Deposit Approved", amount: amount, status: "Completed", timestamp: new Date().getTime(), date: new Date().toLocaleString()
                    });
                } else if (type === "Withdraw") {
                    // Balance was already deducted during request, so just notify
                    notiMsg = `✅ Your withdraw request of Tk ${amount} has been APPROVED and processed!`;
                    
                    await addDoc(collection(db, "customers", customerId, "wallet_history"), {
                        type: "Withdraw Approved", amount: amount, status: "Completed", timestamp: new Date().getTime(), date: new Date().toLocaleString()
                    });
                }
                
                await updateDoc(userRef, { walletBalance: newBalance, adminNotification: notiMsg });
                await updateDoc(reqRef, { status: "Approved", processedAt: new Date().toLocaleString() });

            } else if (action === "Reject") {
                if (type === "Withdraw") {
                    // If rejected, refund the money back to wallet
                    newBalance = currentBalance + amount;
                    await updateDoc(userRef, { walletBalance: newBalance });
                }
                
                notiMsg = `❌ Your ${type} request of Tk ${amount} has been REJECTED.`;
                await updateDoc(userRef, { adminNotification: notiMsg });
                
                await updateDoc(reqRef, { status: "Rejected", processedAt: new Date().toLocaleString() });
                
                await addDoc(collection(db, "customers", customerId, "wallet_history"), {
                    type: `${type} Rejected`, amount: amount, status: "Failed", timestamp: new Date().getTime(), date: new Date().toLocaleString()
                });
            }

            // Send standard notification
            await addDoc(collection(db, "customers", customerId, "notifications"), {
                text: notiMsg, timestamp: new Date().getTime(), isRead: false
            });

            alert(`✅ Request ${action}d successfully!`);

        } catch (e) {
            console.error(e);
            alert("System error occurred while processing request.");
        }
    }
}
// ==========================================
// ⭐ NEW: Banner Delete Function
// ==========================================
window.deleteBanner = async function(bannerNumber) {
    if(confirm("⚠️ Are you sure you want to DELETE Banner " + bannerNumber + "? This will be removed from the live site immediately.")) {
        try {
            // Firebase a kon banner ta delete hobe tar nam ber kora
            let fieldName = bannerNumber === 1 ? "bannerUrl" : "bannerUrl_" + bannerNumber;
            
            // Firebase theke banner er link muche fela (Empty kore deya)
            await updateDoc(doc(db, "settings", "general"), {
                [fieldName]: ""
            });

            // Admin panel er input box gulo faka kore deya
            if(document.getElementById('s_banner_' + bannerNumber)) {
                document.getElementById('s_banner_' + bannerNumber).value = '';
            }
            if(document.getElementById('s_banner_file_' + bannerNumber)) {
                document.getElementById('s_banner_file_' + bannerNumber).value = '';
            }

            alert("🗑️ Banner " + bannerNumber + " Deleted Successfully! Live site theke muche gese.");
        } catch(e) {
            alert("Error deleting banner: " + e.message);
        }
    }
}
// ==========================================
// 🔴 NEW: Delete All Activity Logs
// ==========================================
window.deleteAllLogs = async function() {
    // ডিলিট করার আগে অ্যাডমিনকে একবার ওয়ার্নিং দেওয়া হবে
    if(!confirm("⚠️ Are you sure you want to delete ALL activity logs? This action cannot be undone!")) {
        return; 
    }

    const btn = document.querySelector('button[onclick="deleteAllLogs()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = "⏳ Deleting...";
    btn.disabled = true;

    try {
        // ১. ডাটাবেস থেকে সব লগ খুঁজে আনা
        const logsSnapshot = await getDocs(collection(db, "activity_logs"));
        
        if (logsSnapshot.empty) {
            alert("No logs found to delete!");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        // ২. লুপ চালিয়ে প্রতিটি লগ ডিলিট করা
        const deletePromises = [];
        logsSnapshot.forEach((logDoc) => {
            const docRef = doc(db, "activity_logs", logDoc.id);
            deletePromises.push(deleteDoc(docRef));
        });

        // ৩. সব ডিলিট হওয়া পর্যন্ত অপেক্ষা করা
        await Promise.all(deletePromises);

        alert("✅ All activity logs deleted successfully!");
        
        // লগগুলো আবার নতুন করে লোড করা (যাতে স্ক্রিন ক্লিয়ার হয়ে যায়)
        if(typeof loadActivityLogs === 'function') {
            loadActivityLogs(); 
        }

    } catch (error) {
        console.error("Error deleting logs:", error);
        alert("❌ Failed to delete logs: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
window.toggleNewCategoryBox = function() {
    const categorySelect = document.getElementById("p_category");
    const customCategoryInput = document.getElementById("custom_category_input");

    if (categorySelect.value === "add_new_category") {
        customCategoryInput.style.display = "block";  // বক্সটি দেখাবে
        customCategoryInput.required = true;          // নতুন ক্যাটাগরির নাম দেওয়া বাধ্যতামূলক করবে
        customCategoryInput.focus();                  // সাথে সাথে টাইপ করার জন্য কার্সর চলে যাবে
    } else {
        customCategoryInput.style.display = "none";   // অন্য ক্যাটাগরি সিলেক্ট করলে বক্স লুকিয়ে যাবে
        customCategoryInput.value = "";               // এবং ভেতরের লেখা মুছে যাবে
        customCategoryInput.required = false;
    }
}