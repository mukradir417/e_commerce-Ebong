import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, onSnapshot, updateDoc, setDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// ⭐ NEW: Auth Imports for Customer Login
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

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
const auth = getAuth(app); // ⭐ Auth Initialized

// Variables for Cart, Promo, Delivery, and Products
let cart = [];
let appliedPromoCode = "";
let promoDiscountAmount = 0;
window.paymentNumbers = { bkash: "Not Set", nagad: "Not Set", rocket: "Not Set" };
window.deliveryRates = { inside: 60, outside: 120, freeThreshold: 0, autoFreeEnabled: false }; 
window.allProductsList = []; 

// ⭐ Customer Auth Variables
let currentCustomer = null; 
let customerDetails = {};
let customerAddresses = []; 
let userWishlist = []; // ⭐ NEW: Array to hold wishlist product IDs

// ⭐ NEW: Wallet & Game Variables
window.currentWalletBalance = 0;
window.customerWalletPin = null; // Store fetched PIN logic
window.customerSpinTickets = 0; // Store available spin tickets

// ⭐ Lightbox Variables
let currentLightboxImages = [];
let currentLightboxIndex = 0;

// ⭐ Notification Control Variable
window.salesPopupEnabled = true; // Default is ON

// ⭐ Spin Wheel Variables
let spinSettings = { enabled: true, tier1: "5% Discount", tier2: "Free Delivery", tier3: "10% Discount", tier4: "12% Discount", tier5: "Free Sunglass", tier6: "17% Discount" };
let spinResultText = "";
let spinDiscountAmount = 0;
let hasSpun = false;

// ⭐ Banner Slider Variables
window.bannerSliderInterval = null;

// Make auth status globally available
window.isCustomerLoggedIn = function() {
    return currentCustomer !== null;
}

// ==========================================
// ⭐ CUSTOMER AUTHENTICATION & ADDRESS BOOK
// ==========================================

// Listen for Auth State Changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentCustomer = user;
        
        // Fetch user extra details from Firestore
        const userDoc = await getDoc(doc(db, "customers", user.uid));
        if(userDoc.exists()) {
            customerDetails = userDoc.data();
            
            // ⭐ NEW: Fetch Wallet Balance securely
            window.currentWalletBalance = customerDetails.walletBalance || 0;
            const dashBalance = document.getElementById('wallet-dashboard-balance-main'); // Match new ID
            if(dashBalance) dashBalance.innerText = window.currentWalletBalance;

            // ⭐ NEW: Fetch PIN and Spin Tickets
            window.customerWalletPin = customerDetails.walletPin || null;
            window.customerSpinTickets = customerDetails.spinTickets || 0;
            updateHeaderSpinBadge();
        }

        // Keep SVG format when logged in
        document.getElementById('user-account-btn').innerHTML = `
            <svg class="svg-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" style="stroke: #fff;">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
                <polyline points="17 11 19 13 23 9" style="stroke: #fff; stroke-width: 2;"></polyline>
            </svg>
        `; 
        document.getElementById('user-account-btn').style.background = 'var(--brand-color)';
        document.getElementById('user-account-btn').style.borderRadius = '50%';
        
        // Show direct logout button
        const directLogout = document.getElementById('direct-logout-btn');
        if(directLogout) directLogout.style.display = 'block';

        // Show Manage Wallet Button
        const manageWalletBtn = document.getElementById('manage-wallet-btn');
        if(manageWalletBtn) manageWalletBtn.style.display = 'block';

        // Update Dropdown Details
        const ddName = document.getElementById('dropdown-user-name');
        const ddEmail = document.getElementById('dropdown-user-email');
        if(ddName) ddName.innerText = customerDetails.name || 'Valued Customer';
        if(ddEmail) ddEmail.innerText = customerDetails.email || user.email;

        // Show Notification Bell
        const notiBtn = document.getElementById('notification-btn');
        if(notiBtn) notiBtn.style.display = 'flex';

        // Pre-fill Checkout Form
        if(document.getElementById('c_name')) document.getElementById('c_name').value = customerDetails.name || '';
        if(document.getElementById('c_phone')) document.getElementById('c_phone').value = customerDetails.phone || '';

        // Show Address Selection Dropdown in Checkout
        document.getElementById('checkout-address-selection').style.display = 'block';

        // Load Customer Data (Real-time)
        loadCustomerAddresses();
        listenForAdminNotifications();
        loadWishlist(); 
        loadWalletHistory(); // ⭐ NEW: Load wallet transaction history

        // Listen for real-time wallet updates
        onSnapshot(doc(db, "customers", user.uid), (docSnap) => {
            if(docSnap.exists()){
                let data = docSnap.data();
                window.currentWalletBalance = data.walletBalance || 0;
                window.customerWalletPin = data.walletPin || null;
                window.customerSpinTickets = data.spinTickets || 0;
                
                const dashBal = document.getElementById('wallet-dashboard-balance-main');
                if(dashBal) dashBal.innerText = window.currentWalletBalance;
                
                updateHeaderSpinBadge();
            }
        });

    } else {
        currentCustomer = null;
        customerDetails = {};
        customerAddresses = [];
        userWishlist = [];
        window.currentWalletBalance = 0;
        window.customerWalletPin = null;
        window.customerSpinTickets = 0;
        
        // Reset Header User UI
        document.getElementById('user-account-btn').innerHTML = `
            <svg class="svg-icon" id="user-svg" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
        document.getElementById('user-account-btn').style.background = 'transparent';
        
        // Hide logic
        const directLogout = document.getElementById('direct-logout-btn');
        if(directLogout) directLogout.style.display = 'none';

        const manageWalletBtn = document.getElementById('manage-wallet-btn');
        if(manageWalletBtn) manageWalletBtn.style.display = 'none';

        const headerSpinBtn = document.getElementById('header-spin-btn');
        if(headerSpinBtn) headerSpinBtn.style.display = 'none';
        
        const notiBtn = document.getElementById('notification-btn');
        if(notiBtn) notiBtn.style.display = 'none';

        document.getElementById('checkout-address-selection').style.display = 'none';
        if(document.getElementById('c_address')) document.getElementById('c_address').value = '';
        
        // Reset Wishlist Hearts
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.classList.remove('active');
            btn.innerHTML = '🤍';
        });
    }
});

// Update Header Spin Ticket Count
function updateHeaderSpinBadge() {
    const spinBtn = document.getElementById('header-spin-btn');
    const spinCount = document.getElementById('spin-ticket-count');
    
    if (spinBtn && spinCount) {
        if (window.customerSpinTickets > 0) {
            spinBtn.style.display = 'flex';
            spinCount.innerText = window.customerSpinTickets;
        } else {
            spinBtn.style.display = 'none';
        }
    }
}

// Handle Login / Registration Form Submission
const authForm = document.getElementById('auth-form');
if(authForm) {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('auth-submit-btn');
        const mode = window.currentAuthMode; 
        
        const email = document.getElementById('auth_email').value.trim();
        const password = document.getElementById('auth_password').value;
        const name = document.getElementById('auth_name').value.trim();
        const phone = document.getElementById('auth_phone').value.trim();

        btn.innerText = "Processing...";
        btn.disabled = true;

        try {
            if (mode === 'register') {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                await setDoc(doc(db, "customers", user.uid), {
                    name: name,
                    phone: phone,
                    email: email,
                    walletBalance: 0, 
                    spinTickets: 0, // Initial tickets
                    walletPin: null, // Initial PIN
                    createdAt: new Date().toLocaleString()
                });
                
                alert("Account created successfully!");
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                alert("Logged in successfully!");
            }
            
            document.getElementById('auth-modal').style.display = 'none';
            document.body.classList.remove('modal-open');
            authForm.reset();

        } catch (error) {
            console.error("Auth Error:", error);
            let msg = error.message;
            if(error.code === 'auth/email-already-in-use') msg = "This email is already registered.";
            if(error.code === 'auth/invalid-credential') msg = "Wrong email or password.";
            alert("Error: " + msg);
        } finally {
            btn.innerText = mode === 'register' ? "Sign Up" : "Login";
            btn.disabled = false;
        }
    });
}

// Handle Logout from Dropdown and Profile Modal
window.performLogout = async function() {
    if(confirm("Are you sure you want to logout?")) {
        await signOut(auth);
        document.getElementById('profile-modal').style.display = 'none';
        document.getElementById('user-dropdown-menu').classList.remove('show');
        document.body.classList.remove('modal-open');
        
        if(document.getElementById('c_name')) document.getElementById('c_name').value = '';
        if(document.getElementById('c_phone')) document.getElementById('c_phone').value = '';
        if(document.getElementById('c_address')) document.getElementById('c_address').value = '';
        alert("Logged out successfully.");
    }
}

const logoutBtn = document.getElementById('profile-logout-btn');
if(logoutBtn) logoutBtn.addEventListener('click', performLogout);

const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
if(dropdownLogoutBtn) dropdownLogoutBtn.addEventListener('click', performLogout);

const directLogoutBtn = document.getElementById('direct-logout-btn');
if(directLogoutBtn) directLogoutBtn.addEventListener('click', performLogout);

// ==========================================
// ⭐ NEW: WALLET PIN SECURITY LOGIC
// ==========================================

const manageWalletBtn = document.getElementById('manage-wallet-btn');
if(manageWalletBtn) {
    manageWalletBtn.addEventListener('click', function(e) {
        if (!currentCustomer) {
            document.getElementById('auth-modal').style.display = 'block';
            document.body.classList.add('modal-open');
            return;
        }
        
        if (!window.customerWalletPin) {
            // First time setup PIN
            document.getElementById('set-pin-modal').style.display = 'block';
            document.body.classList.add('modal-open');
        } else {
            // Verify PIN
            document.getElementById('verify-pin-modal').style.display = 'block';
            document.body.classList.add('modal-open');
        }
    });
}

// Function to save new PIN
window.saveNewPin = async function() {
    const pin1 = document.getElementById('set1').value;
    const pin2 = document.getElementById('set2').value;
    const pin3 = document.getElementById('set3').value;
    const pin4 = document.getElementById('set4').value;

    const fullPin = pin1 + pin2 + pin3 + pin4;

    if (fullPin.length !== 4) {
        alert("Please enter a valid 4-digit PIN.");
        return;
    }

    try {
        await updateDoc(doc(db, "customers", currentCustomer.uid), {
            walletPin: fullPin
        });
        
        window.customerWalletPin = fullPin; // update locally
        
        alert("✅ Wallet PIN set successfully! Keep it secret.");
        document.getElementById('set-pin-modal').style.display = 'none';
        
        // Open the actual wallet now
        document.getElementById('wallet-modal').style.display = 'block';
        
    } catch (e) {
        console.error(e);
        alert("Error saving PIN. Try again.");
    }
}

// Function to Verify PIN
window.verifyEnteredPin = function() {
    const pin1 = document.getElementById('ver1').value;
    const pin2 = document.getElementById('ver2').value;
    const pin3 = document.getElementById('ver3').value;
    const pin4 = document.getElementById('ver4').value;
    
    const fullPin = pin1 + pin2 + pin3 + pin4;
    const errorMsg = document.getElementById('pin-error-msg');

    if (fullPin === window.customerWalletPin) {
        // Success
        errorMsg.style.display = 'none';
        document.getElementById('verify-pin-modal').style.display = 'none';
        
        // Clear input for security
        document.getElementById('ver1').value = '';
        document.getElementById('ver2').value = '';
        document.getElementById('ver3').value = '';
        document.getElementById('ver4').value = '';
        
        // Open Wallet Dashboard
        document.getElementById('wallet-modal').style.display = 'block';
    } else {
        // Fail
        errorMsg.style.display = 'block';
    }
}

// ==========================================
// ⭐ NEW: DEPOSIT, WITHDRAW & HISTORY LOGIC
// ==========================================

const depositForm = document.getElementById('deposit-form');
if (depositForm) {
    depositForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentCustomer) return;

        const btn = document.getElementById('deposit-submit-btn');
        btn.innerText = "Submitting...";
        btn.disabled = true;

        const method = document.getElementById('dep_method').value;
        const amount = parseInt(document.getElementById('dep_amount').value);
        const trxId = document.getElementById('dep_trxid').value.trim();

        try {
            await addDoc(collection(db, "wallet_requests"), {
                customerId: currentCustomer.uid,
                customerName: customerDetails.name || 'Unknown',
                customerPhone: customerDetails.phone || 'Unknown',
                type: "Deposit",
                method: method,
                amount: amount,
                trxId: trxId,
                status: "Pending",
                timestamp: new Date().getTime(),
                date: new Date().toLocaleString()
            });

            alert("✅ Deposit Request Submitted! Admin will review it shortly.");
            depositForm.reset();
            document.getElementById('deposit-modal').style.display = 'none';
            document.getElementById('wallet-modal').style.display = 'block'; // Back to wallet

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            btn.innerText = "Submit Request";
            btn.disabled = false;
        }
    });
}

const withdrawForm = document.getElementById('withdraw-form');
if (withdrawForm) {
    withdrawForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentCustomer) return;

        const btn = document.getElementById('withdraw-submit-btn');
        const method = document.getElementById('with_method').value;
        const phone = document.getElementById('with_number').value.trim();
        const amount = parseInt(document.getElementById('with_amount').value);

        if (amount > window.currentWalletBalance) {
            alert("❌ Insufficient Wallet Balance!");
            return;
        }

        btn.innerText = "Requesting...";
        btn.disabled = true;

        try {
            await addDoc(collection(db, "wallet_requests"), {
                customerId: currentCustomer.uid,
                customerName: customerDetails.name || 'Unknown',
                customerPhone: customerDetails.phone || 'Unknown',
                type: "Withdraw",
                method: method,
                withdrawPhone: phone,
                amount: amount,
                status: "Pending",
                timestamp: new Date().getTime(),
                date: new Date().toLocaleString()
            });

            // Deduct balance instantly to prevent double requests (Admin can reject and restore later)
            const newBalance = window.currentWalletBalance - amount;
            await updateDoc(doc(db, "customers", currentCustomer.uid), {
                walletBalance: newBalance
            });

            // Add history log
            await addDoc(collection(db, "customers", currentCustomer.uid, "wallet_history"), {
                type: "Withdraw Request",
                amount: amount,
                status: "Pending",
                timestamp: new Date().getTime(),
                date: new Date().toLocaleString()
            });

            alert("✅ Withdraw Request Submitted Successfully!");
            withdrawForm.reset();
            document.getElementById('withdraw-modal').style.display = 'none';
            document.getElementById('wallet-modal').style.display = 'block'; // Back to wallet

        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            btn.innerText = "Request Withdraw";
            btn.disabled = false;
        }
    });
}

function loadWalletHistory() {
    if (!currentCustomer) return;
    
    const listContainer = document.getElementById('wallet-history-list');
    if (!listContainer) return;

    const q = query(collection(db, "customers", currentCustomer.uid, "wallet_history"));
    
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="text-align: center; color: gray; font-size: 13px; margin: 10px 0;">No transactions yet.</p>';
            return;
        }

        let historyArray = [];
        snapshot.forEach(doc => historyArray.push({ id: doc.id, ...doc.data() }));
        
        // Sort newest first
        historyArray.sort((a, b) => b.timestamp - a.timestamp);

        let html = '';
        historyArray.forEach(item => {
            let icon = "💸";
            let color = "gray";
            let amountPrefix = "";

            if (item.type.includes("Deposit") || item.type.includes("Cashback") || item.type.includes("Bonus") || item.type.includes("Added")) {
                icon = "🟢";
                color = "green";
                amountPrefix = "+";
            } else if (item.type.includes("Withdraw") || item.type.includes("Spend") || item.type.includes("Deducted")) {
                icon = "🔴";
                color = "red";
                amountPrefix = "-";
            }

            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 10px 0;">
                    <div>
                        <strong style="font-size: 13px; color: #333;">${icon} ${item.type}</strong><br>
                        <small style="color: gray; font-size: 11px;">${item.date}</small>
                    </div>
                    <div style="text-align: right;">
                        <strong style="color: ${color}; font-size: 14px;">${amountPrefix}Tk ${item.amount}</strong><br>
                        <span style="font-size: 10px; background: #eee; padding: 2px 6px; border-radius: 4px;">${item.status || 'Completed'}</span>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;
    });
}


// Fallback logic if needed externally
window.checkAndOpenUserModal = function() {
    if (currentCustomer) {
        document.getElementById('profile-user-name').innerText = customerDetails.name || 'Valued Customer';
        document.getElementById('profile-user-email').innerText = customerDetails.email || currentCustomer.email;
        loadCustomerOrderHistory();
        
        document.getElementById('profile-modal').style.display = 'block';
        document.body.classList.add('modal-open');
    } else {
        document.getElementById('auth-modal').style.display = 'block';
        document.body.classList.add('modal-open');
    }
}

// ==========================================
// ⭐ NEW: WISHLIST LOGIC (Toggle Empty/Solid Heart)
// ==========================================
window.toggleWishlist = async function(event, productId) {
    event.stopPropagation(); // Prevents opening product details modal
    
    // If not logged in, show Auth modal immediately
    if(!currentCustomer) {
        document.getElementById('auth-title').innerText = "Please Login";
        document.getElementById('auth-subtitle').innerText = "You need to be logged in to save items to your wishlist.";
        document.getElementById('auth-modal').style.display = 'block';
        document.body.classList.add('modal-open');
        return;
    }

    const btn = event.currentTarget;
    const wishRef = doc(db, "customers", currentCustomer.uid, "wishlist", productId);
    
    try {
        if(userWishlist.includes(productId)) {
            // Remove from wishlist (Make heart empty)
            await deleteDoc(wishRef);
            btn.classList.remove('active');
            btn.innerHTML = '🤍';
            userWishlist = userWishlist.filter(id => id !== productId);
        } else {
            // Add to wishlist (Make heart solid)
            await setDoc(wishRef, { addedAt: new Date().getTime() });
            btn.classList.add('active');
            btn.innerHTML = '❤️';
            userWishlist.push(productId);
        }
    } catch(e) { console.error("Wishlist error:", e); }
}

function loadWishlist() {
    if(!currentCustomer) return;
    onSnapshot(collection(db, "customers", currentCustomer.uid, "wishlist"), (snapshot) => {
        userWishlist = [];
        snapshot.forEach(doc => userWishlist.push(doc.id));
        
        // Update UI for all visible heart buttons on main page
        document.querySelectorAll('.wishlist-btn').forEach(btn => {
            let pid = btn.getAttribute('data-id');
            if(userWishlist.includes(pid)) {
                btn.classList.add('active');
                btn.innerHTML = '❤️';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = '🤍';
            }
        });

        renderWishlistTab();
    });
}

window.renderWishlistTab = function() {
    const container = document.getElementById('profile-wishlist-container');
    if(!container) return;

    if(userWishlist.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-light); font-size: 13px; width: 100%; grid-column: 1/-1;">Your wishlist is empty.</p>';
        return;
    }

    let html = '';
    userWishlist.forEach(pid => {
        let product = window.allProductsList.find(p => p.id === pid);
        if(product) {
            let originalPrice = parseInt(product.price) || 0;
            let discountPrice = parseInt(product.discountPrice) || 0;
            let displayPrice = discountPrice > 0 ? discountPrice : originalPrice;
            
            let imgUrl = '';
            if (product.images && product.images.length > 0) imgUrl = product.images[0];
            else if (product.image_url) imgUrl = product.image_url;

            if (imgUrl && !imgUrl.startsWith('http') && !imgUrl.startsWith('data:')) {
                imgUrl = 'data:image/jpeg;base64,' + imgUrl;
            }

            // Dark Mode Support added
            html += `
                <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; text-align: center; position: relative; cursor: pointer;" onclick="openProductDetails('${pid}')">
                    <button onclick="toggleWishlist(event, '${pid}')" style="position: absolute; top: 5px; right: 5px; background: rgba(255,255,255,0.8); border: none; color: #ff3b30; font-size: 14px; width: 25px; height: 25px; border-radius: 50%; cursor: pointer; z-index: 5; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">✖</button>
                    <img src="${imgUrl}" style="width: 100%; height: 100px; object-fit: contain; border-radius: 5px; margin-bottom: 10px; background: var(--bg-light-grey);" onerror="this.style.display='none'">
                    <h5 style="margin: 0 0 5px 0; font-size: 12px; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name}</h5>
                    <strong style="color: var(--brand-color); font-size: 13px;">Tk ${displayPrice}</strong>
                </div>
            `;
        }
    });
    container.innerHTML = html;
}


// Fetch and display orders for the logged-in customer
async function loadCustomerOrderHistory() {
    const listContainer = document.getElementById('profile-orders-list');
    if(!listContainer || !currentCustomer) return;
    
    listContainer.innerHTML = '<p style="text-align: center; color: var(--text-light); font-size: 14px; padding: 20px;">Loading your orders...</p>';

    try {
        const q = query(collection(db, "orders"), where("customerId", "==", currentCustomer.uid));
        
        onSnapshot(q, (querySnapshot) => {
            if (querySnapshot.empty) {
                listContainer.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px;">You have no order history.</p>';
                return;
            }

            let orders = [];
            querySnapshot.forEach((doc) => {
                orders.push({ id: doc.id, ...doc.data() });
            });
            
            orders.sort((a, b) => new Date(b.date) - new Date(a.date));

            let html = '';
            orders.forEach(order => {
                let statusClass = 'status-pending';
                if(order.status === 'Confirmed' || order.status === 'Processing' || order.status === 'Shipped' || order.status === 'Out for Delivery') statusClass = 'status-pending'; // Orange
                if(order.status === 'Delivered') statusClass = 'status-confirmed'; // Green
                if(order.status === 'Deleted') statusClass = 'status-deleted'; // Red

                let itemsStr = order.items.map(i => `${i.name} (Qty: ${i.qty})`).join("<br>");

                html += `
                    <div class="order-card" style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                        <div class="order-header" style="border-bottom: 1px dashed var(--border-color); padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between;">
                            <strong style="color: var(--text-dark);">Tracking ID: <span style="color:var(--brand-color);">${order.trackingId || order.id.substring(0,6).toUpperCase()}</span></strong>
                            <span class="order-status ${statusClass}" style="font-size: 12px; font-weight: bold; padding: 3px 8px; border-radius: 4px;">${order.status}</span>
                        </div>
                        <div style="font-size: 13px; color: var(--text-dark); margin-bottom: 8px;">
                            ${itemsStr}
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                            <span class="order-date" style="color: var(--text-light); font-size: 12px;">${order.date || 'N/A'}</span>
                            <strong style="color: var(--brand-color);">Tk ${order.totalAmount}</strong>
                        </div>
                    </div>
                `;
            });

            listContainer.innerHTML = html;
        });

    } catch (error) {
        console.error("Error loading order history:", error);
        listContainer.innerHTML = '<p style="text-align: center; color: red;">Error loading orders.</p>';
    }
}

// ⭐ Load Customer Addresses (For Profile & Checkout)
function loadCustomerAddresses() {
    if(!currentCustomer) return;

    onSnapshot(collection(db, "customers", currentCustomer.uid, "addresses"), (snapshot) => {
        customerAddresses = [];
        let listHtml = '';
        let checkoutOptions = '<option value="new">-- Type New Address --</option>';
        
        snapshot.forEach((docSnap) => {
            const addr = { id: docSnap.id, ...docSnap.data() };
            customerAddresses.push(addr);

            const isDefaultHtml = addr.isDefault ? `<span class="default-badge" style="position: absolute; top: 15px; right: 15px; background: #28a745; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold;">DEFAULT</span>` : '';
            const defaultClass = addr.isDefault ? 'is-default' : '';
            const cardBg = addr.isDefault ? 'var(--bg-light-grey)' : 'var(--bg-card)';

            // Profile List HTML
            listHtml += `
                <div class="address-card ${defaultClass}" onclick="setDefaultAddress('${addr.id}')" style="background: ${cardBg}; border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; margin-bottom: 10px; position: relative; cursor: pointer;">
                    ${isDefaultHtml}
                    <h5 style="margin: 0 0 5px 0; color: var(--brand-color); font-size: 15px;">${addr.title}</h5>
                    <p style="margin: 0; font-size: 13px; color: var(--text-dark); line-height: 1.5;">${addr.details}</p>
                    <button class="delete-btn" onclick="event.stopPropagation(); deleteAddress('${addr.id}')" style="position: absolute; bottom: 15px; right: 15px; background: #dc3545; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Delete</button>
                </div>
            `;

            // Checkout Dropdown HTML
            checkoutOptions += `<option value="${addr.id}" ${addr.isDefault ? 'selected' : ''}>${addr.title} - ${addr.details.substring(0,20)}...</option>`;
            
            // Auto fill checkout text area if this is default
            if(addr.isDefault && document.getElementById('c_address')) {
                document.getElementById('c_address').value = addr.details;
            }
        });

        const listContainer = document.getElementById('profile-address-list');
        if(listContainer) {
            if(customerAddresses.length === 0) listContainer.innerHTML = '<p style="text-align: center; color: var(--text-light); font-size: 13px;">No addresses saved yet.</p>';
            else listContainer.innerHTML = listHtml;
        }

        const dropDown = document.getElementById('checkout-address-dropdown');
        if(dropDown) {
            dropDown.innerHTML = checkoutOptions;
        }
    });
}

// Handle Address Checkout Selection
const addrDropdown = document.getElementById('checkout-address-dropdown');
if(addrDropdown) {
    addrDropdown.addEventListener('change', function() {
        const addrBox = document.getElementById('c_address');
        if(this.value === 'new') {
            addrBox.value = '';
            addrBox.readOnly = false;
            addrBox.focus();
        } else {
            const selectedAddr = customerAddresses.find(a => a.id === this.value);
            if(selectedAddr) {
                addrBox.value = selectedAddr.details;
            }
        }
    });
}

// Add New Address Form
const addAddrForm = document.getElementById('add-address-form');
if(addAddrForm) {
    addAddrForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentCustomer) return;

        const title = document.getElementById('new_addr_title').value.trim();
        const details = document.getElementById('new_addr_details').value.trim();

        try {
            // Check if it's the first address, make it default
            const isFirst = customerAddresses.length === 0;

            await addDoc(collection(db, "customers", currentCustomer.uid, "addresses"), {
                title: title,
                details: details,
                isDefault: isFirst
            });
            
            addAddrForm.reset();
            alert("✅ Address saved successfully!");
        } catch (e) { console.error(e); alert("Failed to save address."); }
    });
}

// Set Address as Default
window.setDefaultAddress = async function(addrId) {
    if(!currentCustomer) return;
    try {
        // Remove default from all
        for(let addr of customerAddresses) {
            await updateDoc(doc(db, "customers", currentCustomer.uid, "addresses", addr.id), { isDefault: false });
        }
        // Set new default
        await updateDoc(doc(db, "customers", currentCustomer.uid, "addresses", addrId), { isDefault: true });
    } catch(e) { console.log(e); }
}

// Delete Address
window.deleteAddress = async function(addrId) {
    if(confirm("Delete this address?")) {
        try {
            await deleteDoc(doc(db, "customers", currentCustomer.uid, "addresses", addrId));
        } catch(e) { console.log(e); }
    }
}


// ==========================================
// ⭐ NEW: BELL NOTIFICATION SYSTEM LOGIC
// ==========================================
function listenForAdminNotifications() {
    if(!currentCustomer) return;

    // 1. Listen for the immediate string trigger from admin
    onSnapshot(doc(db, "customers", currentCustomer.uid), async (docSnap) => {
        if(docSnap.exists()) {
            const data = docSnap.data();
            
            if(data.adminNotification && data.adminNotification.trim() !== "") {
                const msg = data.adminNotification;
                
                // Show Popup Immediately
                const pop = document.getElementById('admin-notification-popup');
                const text = document.getElementById('admin-notification-text');
                if(pop && text) {
                    text.innerText = msg;
                    pop.style.display = 'block';
                    setTimeout(() => { pop.style.display = 'none'; }, 15000);
                }

                // Move to Subcollection to save history
                await addDoc(collection(db, "customers", currentCustomer.uid, "notifications"), {
                    text: msg,
                    timestamp: new Date().getTime(),
                    isRead: false
                });

                // Clear the trigger string
                await updateDoc(doc(db, "customers", currentCustomer.uid), { adminNotification: "" });
            }
        }
    });

    // 2. Listen to the Notifications Subcollection to update Dropdown Panel & Badge
    onSnapshot(collection(db, "customers", currentCustomer.uid, "notifications"), (snapshot) => {
        let notis = [];
        snapshot.forEach(docSnap => notis.push({ id: docSnap.id, ...docSnap.data() }));
        
        notis.sort((a, b) => b.timestamp - a.timestamp); // Newest first

        let unreadCount = notis.filter(n => !n.isRead).length;
        const badge = document.getElementById('noti-count');
        if(badge) {
            if(unreadCount > 0) {
                badge.innerText = unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        const listContainer = document.getElementById('notification-list');
        if(!listContainer) return;

        if(notis.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-light); padding: 20px; font-size: 13px;">No new notifications</p>';
            return;
        }

        let html = '';
        notis.forEach(n => {
            let dateStr = new Date(n.timestamp).toLocaleString([], {hour: '2-digit', minute:'2-digit', month: 'short', day: 'numeric'});
            let readClass = n.isRead ? 'unread' : ''; // Fixed Read Class Logic
            
            let bgStyle = n.isRead ? 'var(--bg-card)' : 'var(--bg-light-grey)';
            let borderStyle = n.isRead ? '1px solid var(--border-color)' : '1px solid var(--brand-color)';

            html += `
                <div class="noti-item ${readClass}" style="background: ${bgStyle}; border-bottom: ${borderStyle}; padding: 15px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div class="noti-content" style="flex: 1;">
                        <p style="margin: 0 0 5px 0; font-size: 13px; color: var(--text-dark); line-height: 1.4;">${n.text}</p>
                        <small style="font-size: 11px; color: var(--text-light);">🕒 ${dateStr}</small>
                    </div>
                    <button class="noti-delete" onclick="deleteNotification('${n.id}')" title="Delete" style="background: none; border: none; color: #ff3b30; cursor: pointer; font-size: 16px; padding: 5px;">✖</button>
                </div>
            `;
        });
        listContainer.innerHTML = html;
    });
}

window.markNotificationsAsRead = async function() {
    if(!currentCustomer) return;
    try {
        const q = query(collection(db, "customers", currentCustomer.uid, "notifications"), where("isRead", "==", false));
        const snaps = await getDocs(q);
        snaps.forEach(docSnap => {
            updateDoc(doc(db, "customers", currentCustomer.uid, "notifications", docSnap.id), { isRead: true });
        });
    } catch(e) { console.error(e); }
}

window.deleteNotification = async function(id) {
    if(!currentCustomer) return;
    try {
        await deleteDoc(doc(db, "customers", currentCustomer.uid, "notifications", id));
    } catch(e) { console.error(e); }
}

window.clearAllNotifications = async function() {
    if(!currentCustomer) return;
    if(confirm("Are you sure you want to clear all notifications?")) {
        try {
            const snaps = await getDocs(collection(db, "customers", currentCustomer.uid, "notifications"));
            snaps.forEach(docSnap => {
                deleteDoc(docSnap.ref);
            });
        } catch(e) { console.error(e); }
    }
}


// Load Settings, Payment & Delivery
async function loadSettings() {
    console.log("Loading settings...");
    try {
        const docSnap = await getDoc(doc(db, "settings", "general"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            if(data.salesPopupEnabled !== undefined) {
                window.salesPopupEnabled = data.salesPopupEnabled;
            }

            let banners = [];
            if(data.bannerUrl && data.bannerUrl.trim() !== '') banners.push(data.bannerUrl);
            if(data.bannerUrl_2 && data.bannerUrl_2.trim() !== '') banners.push(data.bannerUrl_2);
            if(data.bannerUrl_3 && data.bannerUrl_3.trim() !== '') banners.push(data.bannerUrl_3);
            if(data.bannerUrl_4 && data.bannerUrl_4.trim() !== '') banners.push(data.bannerUrl_4);
            if(data.bannerUrl_5 && data.bannerUrl_5.trim() !== '') banners.push(data.bannerUrl_5);
            
            const slideTime = (parseInt(data.bannerSlideTime) || 3) * 1000; 
            
            const sliderContainer = document.getElementById('main-banner-slider');
            const dotsContainer = document.getElementById('banner-dots-container');

            if (sliderContainer && banners.length > 0) {
                sliderContainer.innerHTML = ''; 
                let dotsHtml = '';

                banners.forEach((url, index) => {
                    let img = document.createElement('img');
                    img.src = url;
                    img.className = `multi-banner-slide ${index === 0 ? 'active' : ''}`;
                    sliderContainer.appendChild(img);

                    dotsHtml += `<span class="banner-dot ${index === 0 ? 'active' : ''}" onclick="goToBanner(${index})"></span>`;
                });

                if (banners.length > 1) {
                    if(dotsContainer) {
                        dotsContainer.innerHTML = dotsHtml;
                        dotsContainer.style.display = 'block';
                    }
                    startBannerSlider(slideTime, banners.length);
                } else {
                    if(dotsContainer) dotsContainer.style.display = 'none';
                }
            }

            if(data.headline) document.getElementById('dynamic-headline').innerText = data.headline;
            
            if(data.phone) {
                if(document.getElementById('top-phone')) document.getElementById('top-phone').innerText = `📞 ${data.phone}`;
                if(document.getElementById('footer-phone')) document.getElementById('footer-phone').innerHTML = `📞 <strong>Phone:</strong> ${data.phone}`;
            }
            if(data.email) {
                if(document.getElementById('top-email')) document.getElementById('top-email').innerText = `📧 ${data.email}`;
                if(document.getElementById('footer-email')) document.getElementById('footer-email').innerHTML = `📧 <strong>Email:</strong> ${data.email}`;
            }
            if(data.address && document.getElementById('footer-address')) document.getElementById('footer-address').innerHTML = `📍 <strong>Address:</strong> ${data.address}`;
            
            if(data.whatsapp) {
                let waUrl = `https://wa.me/${data.whatsapp}`;
                if(document.getElementById('wa-link')) document.getElementById('wa-link').href = waUrl;
                if(document.getElementById('top-wa-link')) document.getElementById('top-wa-link').href = waUrl; 
            }
            if(data.messenger) {
                if(document.getElementById('fb-link')) document.getElementById('fb-link').href = data.messenger;
                if(document.getElementById('top-fb-link')) document.getElementById('top-fb-link').href = data.messenger; 
            }
        }

        const paySnap = await getDoc(doc(db, "settings", "payment"));
        if (paySnap.exists()) window.paymentNumbers = paySnap.data();

        const delSnap = await getDoc(doc(db, "settings", "delivery"));
        if (delSnap.exists()) {
            const data = delSnap.data();
            window.deliveryRates.inside = data.inside || 60;
            window.deliveryRates.outside = data.outside || 120;
            window.deliveryRates.freeThreshold = data.freeThreshold !== undefined ? data.freeThreshold : 0; 
            window.deliveryRates.autoFreeEnabled = data.autoFreeEnabled !== undefined ? data.autoFreeEnabled : false; 

            const delZoneSelect = document.getElementById('delivery_zone');
            if(delZoneSelect) {
                delZoneSelect.innerHTML = `
                    <option value="${window.deliveryRates.inside}">Inside Rangpur (Tk ${window.deliveryRates.inside})</option>
                    <option value="${window.deliveryRates.outside}">Outside Rangpur (Tk ${window.deliveryRates.outside})</option>
                `;
            }
        }

        const spinSnap = await getDoc(doc(db, "settings", "spin"));
        if (spinSnap.exists()) {
            const spinData = spinSnap.data();
            spinSettings.enabled = spinData.enabled !== false; 
            if(spinData.tier1) spinSettings.tier1 = spinData.tier1;
            if(spinData.tier2) spinSettings.tier2 = spinData.tier2;
            if(spinData.tier3) spinSettings.tier3 = spinData.tier3;
            if(spinData.tier4) spinSettings.tier4 = spinData.tier4;
            if(spinData.tier5) spinSettings.tier5 = spinData.tier5;
            if(spinData.tier6) spinSettings.tier6 = spinData.tier6;
        }

        console.log("Settings loaded successfully!");
    } catch (e) { console.error("Settings Load Error:", e); }
}

let currentBannerIdx = 0;
function startBannerSlider(intervalTime, totalBanners) {
    if(window.bannerSliderInterval) clearInterval(window.bannerSliderInterval);
    
    window.bannerSliderInterval = setInterval(() => {
        let nextIdx = (currentBannerIdx + 1) % totalBanners;
        window.goToBanner(nextIdx);
    }, intervalTime);
}

window.goToBanner = function(index) {
    const slides = document.querySelectorAll('.multi-banner-slide');
    const dots = document.querySelectorAll('.banner-dot');
    
    if (slides.length === 0) return;

    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    slides[index].classList.add('active');
    if(dots[index]) dots[index].classList.add('active');

    currentBannerIdx = index;
}


// Load Products (Updated with Dynamic Menu Dropdowns)
async function loadProducts() {
    const mainContainer = document.getElementById('all-categories-container');
    if(!mainContainer) return; 
    
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        if(querySnapshot.empty) { 
            mainContainer.innerHTML = '<p style="text-align:center; padding: 20px;">No products found in the database.</p>'; 
            return; 
        }
        
        mainContainer.innerHTML = ''; 
        let categories = {};
        window.allProductsList = []; 

        querySnapshot.forEach((docSnap) => {
            const product = docSnap.data();
            product.id = docSnap.id;
            window.allProductsList.push(product); 
            const cat = product.category || 'Uncategorized';
            if(!categories[cat]) categories[cat] = [];
            categories[cat].push(product);
        });

        // ⭐ UPDATED: DYNAMIC PROFESSIONAL MENU GENERATION
        const categoryMenu = document.getElementById('dynamic-category-menu');
        if(categoryMenu) {
            let menuHtml = '';
            
            Object.keys(categories).forEach(catName => {
                let safeCatId = catName.replace(/\s+/g, '-').toLowerCase();
                let subProducts = categories[catName].slice(0, 5); 
                
                let subLinksHtml = subProducts.map(p => {
                    return `<a class="dropdown-sub-link" onclick="openProductDetails('${p.id}')">${p.name.substring(0, 20)}...</a>`;
                }).join('');
                
                subLinksHtml += `<a class="dropdown-sub-link" style="color: var(--brand-color); font-weight: bold; text-align: center;" onclick="scrollToCategory('cat-${safeCatId}')">View All ${catName} ➔</a>`;

                menuHtml += `
                    <li class="category-item">
                        <button class="category-link" onclick="scrollToCategory('cat-${safeCatId}')">
                            ${catName}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 2px;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div class="mega-dropdown">
                            ${subLinksHtml}
                        </div>
                    </li>
                `;
            });
            
            categoryMenu.innerHTML = menuHtml;
        }

        for (const [categoryName, products] of Object.entries(categories)) {
            let safeCategoryId = categoryName.replace(/\s+/g, '-').toLowerCase(); 
            
            let sectionHtml = `
                <div class="category-section" id="cat-${safeCategoryId}" style="margin-bottom: 50px; scroll-margin-top: 80px;">
                    <div class="section-header" style="border-bottom: 2px solid var(--border-color); margin-bottom: 20px;">
                        <h2 style="margin: 0; padding-bottom: 10px; color: var(--brand-color);">${categoryName}</h2>
                    </div>
                    <div class="product-grid">
            `;

            products.forEach(product => {
                let originalPrice = parseInt(product.price) || 0;
                let discountPrice = parseInt(product.discountPrice) || 0;
                let actualPriceToCart = originalPrice;
                let priceHtml = `<span class="current-price" style="color: var(--text-dark);">Tk ${originalPrice}</span>`;

                if (discountPrice > 0 && discountPrice < originalPrice) {
                    priceHtml = `<span style="text-decoration: line-through; color: var(--text-light); font-size: 14px;">Tk ${originalPrice}</span> <span class="current-price" style="color: red;">Tk ${discountPrice}</span>`;
                    actualPriceToCart = discountPrice;
                }

                // ⭐ NEW: Add Cashback Badge Logic
                let cashbackHtml = '';
                if(product.cashback && product.cashback !== "0" && product.cashback !== "") {
                    let cText = product.cashback.includes('%') ? product.cashback : `৳ ${product.cashback}`;
                    cashbackHtml = `<div style="position: absolute; top: 10px; left: 10px; background: #e83e8c; color: white; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; z-index: 5; box-shadow: 0 2px 5px rgba(232, 62, 140, 0.4);">🔥 ${cText} Cashback</div>`;
                }

                let isStockOut = parseInt(product.stock) <= 0;
                let productCode = product.code || 'N/A';
                
                let btnHtml = isStockOut 
                    ? `<button class="add-to-cart-btn" disabled style="background: var(--bg-light-grey); border-color: var(--border-color); color: var(--text-light); cursor: not-allowed; width: 100%;">❌ Out of Stock</button>`
                    : `<div style="display: flex; gap: 8px; margin-top: 10px;">
                         <button class="add-to-cart-btn" onclick="openProductDetails('${product.id}')" style="flex: 1; padding: 8px 5px; font-size: 13px;">🛒 Add to Cart</button>
                         <button class="buy-now-btn" onclick="openProductDetails('${product.id}')" style="flex: 1; padding: 8px 5px; font-size: 13px; background-color: var(--brand-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">⚡ Buy Now</button>
                       </div>`;

                let imageHtml = '';
                let validImages = [];

                if (product.images && Array.isArray(product.images)) {
                    validImages = product.images.filter(img => typeof img === 'string' && img.trim() !== '');
                } 
                if (validImages.length === 0 && typeof product.image === 'string' && product.image.trim() !== '') {
                    validImages = [product.image.trim()];
                }

                validImages = validImages.map(imgUrl => {
                    let safeUrl = imgUrl.trim();
                    if (safeUrl && !safeUrl.startsWith('http') && !safeUrl.startsWith('data:')) {
                        return 'data:image/jpeg;base64,' + safeUrl;
                    }
                    return safeUrl;
                });

                if (validImages.length === 1) {
                    imageHtml = `<img src="${validImages[0]}" class="product-img view-details-trigger" onclick="openProductDetails('${product.id}')" style="width: 100%; height: auto; aspect-ratio: 1 / 1; object-fit: contain; border-radius: 8px 8px 0 0; cursor: pointer; background: var(--bg-white);" onerror="this.style.display='none'">`;
                } else if (validImages.length > 1) {
                    let slides = validImages.map((safeUrl, index) => {
                        let opacity = index === 0 ? '1' : '0';
                        let zIndex = index === 0 ? '2' : '1';
                        return `<img src="${safeUrl}" class="slider-item" style="position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: contain; border-radius: 8px 8px 0 0; background: var(--bg-white); opacity: ${opacity}; z-index: ${zIndex}; transition: opacity 1s ease-in-out;" onerror="this.style.display='none'">`;
                    }).join('');
                    
                    imageHtml = `<div class="product-slider-container view-details-trigger" onclick="openProductDetails('${product.id}')" style="position: relative; width: 100%; height: auto; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 8px 8px 0 0; background-color: var(--bg-white); cursor: pointer;" data-current="0">
                        ${slides}
                    </div>`;
                } else {
                    imageHtml = `<div class="view-details-trigger" onclick="openProductDetails('${product.id}')" style="width: 100%; aspect-ratio: 1 / 1; background-color: var(--bg-light-grey); border-radius: 8px 8px 0 0; cursor: pointer;"></div>`;
                }

                // Wishlist Logic
                let heartClass = userWishlist.includes(product.id) ? 'active' : '';
                let heartIcon = userWishlist.includes(product.id) ? '❤️' : '🤍';
                
                let wishlistBtnHtml = `<button class="wishlist-btn ${heartClass}" onclick="toggleWishlist(event, '${product.id}')" data-id="${product.id}" title="Add to Wishlist">${heartIcon}</button>`;

                sectionHtml += `
                    <div class="product-card" style="${isStockOut ? 'opacity: 0.7;' : ''} background: var(--bg-card); border-color: var(--border-color);">
                        ${cashbackHtml}
                        ${wishlistBtnHtml}
                        ${imageHtml}
                        <div style="padding: 10px;">
                            <h3 class="product-name view-details-trigger" onclick="openProductDetails('${product.id}')" style="margin-bottom: 5px; cursor: pointer; transition: 0.3s; color: var(--text-dark);" onmouseover="this.style.color='var(--brand-color)'" onmouseout="this.style.color='var(--text-dark)'">${product.name || 'No Name'}</h3>
                            <p style="font-size: 13px; color: var(--brand-color); font-weight: bold; margin: 0;">Code: ${productCode}</p>
                            <p style="font-size: 12px; color: var(--text-light); margin: 5px 0; height: 35px; overflow: hidden;">${product.description || ''}</p>
                            <div class="price-area" style="color: var(--text-dark);">${priceHtml}</div>
                            ${btnHtml}
                        </div>
                    </div>
                `;
            });

            sectionHtml += `</div></div>`;
            mainContainer.innerHTML += sectionHtml;
        }

        if(window.sliderInterval) clearInterval(window.sliderInterval);
        window.sliderInterval = setInterval(() => {
            document.querySelectorAll('.product-slider-container').forEach(slider => {
                let images = slider.querySelectorAll('.slider-item');
                if(images.length <= 1) return;
                
                let currentIdx = parseInt(slider.getAttribute('data-current') || '0');
                images[currentIdx].style.opacity = '0';
                images[currentIdx].style.zIndex = '1';
                
                let nextIdx = (currentIdx + 1) % images.length;
                images[nextIdx].style.opacity = '1';
                images[nextIdx].style.zIndex = '2';
                
                slider.setAttribute('data-current', nextIdx);
            });
        }, 3000); 

        renderWishlistTab();

    } catch (error) {
        console.error("Critical Error Loading Products:", error);
    }
}

window.scrollToCategory = function(categoryId) {
    const element = document.getElementById(categoryId);
    if(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.addToCart = function(productId, name, code, price, size, color, showAlert = true) {
    let existingItem = cart.find(item => item.code === code && item.size === size && item.color === color);
    if(existingItem) existingItem.qty += 1;
    else cart.push({ productId, name, code, price, size, color, qty: 1 }); 
    updateCartUI();
    
    if(showAlert) {
        alert(`Added ${name} (Size: ${size}, Color: ${color}) to cart!`);
    }
}

window.processCartAdd = function(productId, name, code, price, isAddToCart) {
    let sizeRadio = document.querySelector('input[name="selected_size"]:checked');
    if (!sizeRadio) {
        alert("Please select a size first!");
        return;
    }
    
    let colorRadio = document.querySelector('input[name="selected_color"]:checked');
    if (!colorRadio) {
        alert("Please select a color first!");
        return;
    }

    let selectedSize = sizeRadio.value;
    let selectedColor = colorRadio.value;
    
    addToCart(productId, name, code, price, selectedSize, selectedColor, isAddToCart);
    
    document.getElementById('product-details-modal').style.display = 'none';
    document.body.classList.remove('modal-open'); 
    
    if(!isAddToCart) { 
        const modalEl = document.getElementById('checkout-modal');
        modalEl.style.display = 'block';
        document.body.classList.add('modal-open'); 
        setTimeout(() => {
            const nameInput = document.getElementById('c_name');
            if (nameInput) {
                nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                nameInput.focus();
            }
        }, 200);
    }
}

window.selectSizeOption = function(element) {
    document.querySelectorAll('.size-option').forEach(el => el.classList.remove('selected'));
    element.parentElement.classList.add('selected');
}

window.selectColorOption = function(element, imageUrl) {
    document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
    element.parentElement.classList.add('selected');

    if(imageUrl) {
        const mainImg = document.getElementById('main-detail-image');
        mainImg.src = imageUrl;
        mainImg.style.display = 'block'; 
        
        let foundIndex = currentLightboxImages.indexOf(imageUrl);
        if(foundIndex !== -1) {
            currentLightboxIndex = foundIndex;
        }
    }
}

window.openProductDetails = function(productId) {
    const product = window.allProductsList.find(p => p.id === productId);
    if(!product) return;

    const modal = document.getElementById('product-details-modal');
    
    document.getElementById('detail-name').innerText = product.name || 'Unknown';
    document.getElementById('detail-code-text').innerText = product.code || 'N/A';
    document.getElementById('detail-desc-text').innerText = product.description || 'No description available.';

    let originalPrice = parseInt(product.price) || 0;
    let discountPrice = parseInt(product.discountPrice) || 0;
    let actualPriceToCart = originalPrice;
    let priceHtml = `<span style="color: var(--brand-color);">Tk ${originalPrice}</span>`;
    
    if (discountPrice > 0 && discountPrice < originalPrice) {
        priceHtml = `<span style="text-decoration: line-through; color: var(--text-light); font-size: 16px;">Tk ${originalPrice}</span> <span style="color: red; margin-left:10px;">Tk ${discountPrice}</span>`;
        actualPriceToCart = discountPrice;
    }
    document.getElementById('detail-price-area').innerHTML = priceHtml;

    let isStockOut = parseInt(product.stock) <= 0;
    let safeName = (product.name || 'Unknown').replace(/"/g, '&quot;');
    let productCode = product.code || 'N/A';

    let colorArea = document.getElementById('detail-color-options');
    if(colorArea) {
        let colorHtml = '';
        if (product.colorImageMap) {
            let entries = Object.entries(product.colorImageMap);
            entries.forEach(([cName, cUrl], idx) => {
                let isChecked = idx === 0 ? 'checked' : '';
                let isSelectedClass = idx === 0 ? 'selected' : '';
                colorHtml += `<label class="color-option ${isSelectedClass}"><input type="radio" name="selected_color" value="${cName}" ${isChecked} onchange="selectColorOption(this, '${cUrl}')"> <span style="color: var(--text-dark);">${cName}</span></label>`;
            });
        }
        
        if (colorHtml === '') {
            colorHtml = `<label class="color-option selected"><input type="radio" name="selected_color" value="Standard" checked onchange="selectColorOption(this)"> <span style="color: var(--text-dark);">Standard Color</span></label>`;
        }
        colorArea.innerHTML = colorHtml;
    }

    let sizeArea = document.getElementById('detail-size-options');
    if(sizeArea) {
        let sizeHtml = '';
        let firstAvailable = null;
        
        if (product.sizes) {
            for (let [sz, sqty] of Object.entries(product.sizes)) {
                if (sqty > 0) {
                    if(!firstAvailable) firstAvailable = sz;
                    let isChecked = firstAvailable === sz ? 'checked' : '';
                    let isSelectedClass = firstAvailable === sz ? 'selected' : '';
                    sizeHtml += `<label class="size-option ${isSelectedClass}"><input type="radio" name="selected_size" value="${sz}" ${isChecked} onchange="selectSizeOption(this)"> <span style="color: var(--text-dark);">${sz}</span></label>`;
                }
            }
        }
        
        if (sizeHtml === '') {
            sizeHtml = `<label class="size-option selected"><input type="radio" name="selected_size" value="Standard" checked onchange="selectSizeOption(this)"> <span style="color: var(--text-dark);">Standard Size</span></label>`;
        }
        sizeArea.innerHTML = sizeHtml;
    }
    
    if(isStockOut) {
        document.getElementById('detail-stock-status').innerHTML = '<span style="color:red; font-weight:bold;">❌ Out of Stock</span>';
        if(sizeArea) sizeArea.innerHTML = '<p style="color:red; font-size:13px; margin:0;">Out of stock</p>';
        document.getElementById('detail-action-btns').innerHTML = `<button class="btn-submit" disabled style="background:var(--border-color); color:var(--text-light); cursor:not-allowed;">Out of Stock</button>`;
    } else {
        document.getElementById('detail-stock-status').innerHTML = '<span style="color:green; font-weight:bold;">✅ In Stock</span>';
        document.getElementById('detail-action-btns').innerHTML = `
            <button onclick="processCartAdd('${product.id}', '${safeName}', '${productCode}', ${actualPriceToCart}, true)" style="flex:1; background: transparent; border: 2px solid var(--brand-color); color: var(--brand-color); padding: 12px; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer;">🛒 Add to Cart</button>
            <button onclick="processCartAdd('${product.id}', '${safeName}', '${productCode}', ${actualPriceToCart}, false)" style="flex:1; background: var(--brand-color); color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; font-size: 15px; cursor: pointer;">⚡ Buy Now</button>
        `;
    }

    let validImages = [];
    if (product.images && Array.isArray(product.images)) validImages = product.images.filter(img => typeof img === 'string' && img.trim() !== '');
    if (validImages.length === 0 && typeof product.image === 'string' && product.image.trim() !== '') validImages = [product.image.trim()];

    validImages = validImages.map(imgUrl => {
        let safeUrl = imgUrl.trim();
        if (safeUrl && !safeUrl.startsWith('http') && !safeUrl.startsWith('data:')) return 'data:image/jpeg;base64,' + safeUrl;
        return safeUrl;
    });

    const mainImg = document.getElementById('main-detail-image');
    const thumbContainer = document.getElementById('thumbnail-container');
    
    currentLightboxImages = validImages;
    currentLightboxIndex = 0;

    if(validImages.length > 0) {
        mainImg.src = validImages[0];
        mainImg.style.display = 'block'; 
        
        thumbContainer.innerHTML = validImages.map((img, idx) => `
            <img src="${img}" class="${idx === 0 ? 'active' : ''}" onclick="changeMainDetailImage(this, '${img}', ${idx})">
        `).join('');
    } else {
        mainImg.src = '';
        mainImg.style.display = 'none'; 
        thumbContainer.innerHTML = '';
    }

    modal.style.display = 'block';
    document.body.classList.add('modal-open'); 
};

window.changeMainDetailImage = function(element, src, index) {
    let mainImg = document.getElementById('main-detail-image');
    mainImg.src = src;
    mainImg.style.display = 'block'; 
    
    document.querySelectorAll('#thumbnail-container img').forEach(img => img.classList.remove('active'));
    element.classList.add('active');
    
    if(index !== undefined) {
        currentLightboxIndex = index;
    }
};

window.openLightbox = function() {
    if(currentLightboxImages.length === 0) return;
    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    
    lightboxImg.src = document.getElementById('main-detail-image').src;
    lightbox.style.display = 'flex';
    
    document.getElementById('product-details-modal').style.display = 'none';
}

window.closeLightbox = function() {
    document.getElementById('image-lightbox').style.display = 'none';
    document.getElementById('product-details-modal').style.display = 'block';
}

window.changeLightboxImage = function(direction) {
    if(currentLightboxImages.length <= 1) return;
    
    currentLightboxIndex += direction;
    
    if(currentLightboxIndex >= currentLightboxImages.length) currentLightboxIndex = 0;
    if(currentLightboxIndex < 0) currentLightboxIndex = currentLightboxImages.length - 1;
    
    document.getElementById('lightbox-img').src = currentLightboxImages[currentLightboxIndex];
    
    let mainImg = document.getElementById('main-detail-image');
    mainImg.src = currentLightboxImages[currentLightboxIndex];
    mainImg.style.display = 'block'; 
    
    document.querySelectorAll('#thumbnail-container img').forEach((img, idx) => {
        if(idx === currentLightboxIndex) {
            img.classList.add('active');
        } else {
            img.classList.remove('active');
        }
    });
}

const closeDetailsBtn = document.getElementById('close-details-modal');
if(closeDetailsBtn) {
    closeDetailsBtn.onclick = () => {
        document.getElementById('product-details-modal').style.display = 'none';
        document.body.classList.remove('modal-open'); 
    }
}

function updateCartUI() {
    const cartList = document.getElementById("cart-items-list");
    let subtotal = 0, totalItems = 0;
    
    if(cart.length === 0) { 
        if(cartList) cartList.innerHTML = "<p style='color: var(--text-light);'>Cart is empty.</p>"; 
        promoDiscountAmount = 0; 
        appliedPromoCode = ""; 
        const msg = document.getElementById('promo_msg');
        if(msg) msg.innerText = "";
        
        const spinContainer = document.getElementById('spin-offer-container');
        if(spinContainer) spinContainer.style.display = 'none';
        
    } else {
        if(cartList) {
            cartList.innerHTML = cart.map((item, i) => {
                let itemTotal = item.price * item.qty;
                subtotal += itemTotal; totalItems += item.qty;
                // ⭐ FIX: Removed hardcoded background and border
                return `<div class="cart-item-row" style="border-bottom: 1px solid var(--border-color); padding: 10px 0; display: flex; justify-content: space-between; align-items: center; color: var(--text-dark);">
                    <div class="cart-item-info">
                        <strong>${item.name}</strong> <br>
                        <small style="color:var(--text-light);">Code: ${item.code} | Size: <b style="color:var(--brand-color);">${item.size}</b> | Color: <b style="color:var(--brand-color);">${item.color}</b></small><br>
                        <small>Tk ${item.price}</small>
                    </div>
                    <div class="cart-qty-controls" style="display:flex; align-items:center; gap:5px;">
                        <button type="button" class="qty-btn" onclick="changeQty(${i}, -1)" style="padding: 2px 8px; cursor: pointer; color: var(--text-dark); background: var(--bg-card); border: 1px solid var(--border-color);">-</button>
                        <span>${item.qty}</span>
                        <button type="button" class="qty-btn" onclick="changeQty(${i}, 1)" style="padding: 2px 8px; cursor: pointer; color: var(--text-dark); background: var(--bg-card); border: 1px solid var(--border-color);">+</button>
                    </div>
                    <div class="cart-item-price" style="font-weight: bold;">Tk ${itemTotal}</div>
                </div>`;
            }).join('');
        }
        
        const spinContainer = document.getElementById('spin-offer-container');
        if(spinContainer) {
            if(spinSettings.enabled) {
                spinContainer.style.display = 'block';
                const spinBtn = document.getElementById('open-spin-modal-btn');
                
                if(hasSpun || isSpinCooldownActive()) {
                    if(spinBtn) {
                        spinBtn.innerText = "Spin Used Today";
                        spinBtn.style.background = "var(--border-color)";
                        spinBtn.style.color = "var(--text-light)";
                        spinBtn.style.animation = "none";
                        spinBtn.style.cursor = "not-allowed";
                        spinBtn.disabled = true;
                    }
                } else {
                    if(spinBtn) {
                        spinBtn.innerText = "🎡 Spin Now";
                        spinBtn.style.background = "var(--brand-color)";
                        spinBtn.style.color = "white";
                        spinBtn.style.animation = "pulse 1.5s infinite";
                        spinBtn.style.cursor = "pointer";
                        spinBtn.disabled = false;
                    }
                }
            } else {
                spinContainer.style.display = 'none';
            }
        }
    }
    
    if(document.getElementById('cart-count')) document.getElementById('cart-count').innerText = totalItems;
    if(document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').innerText = subtotal;

    let deliverySelect = document.getElementById('delivery_zone');
    let baseDeliveryCharge = deliverySelect ? parseInt(deliverySelect.value) : 0;
    let deliveryCharge = baseDeliveryCharge;
    
    let threshold = window.deliveryRates.freeThreshold; 
    let isAutoFreeEnabled = window.deliveryRates.autoFreeEnabled; 
    const freeDelMsg = document.getElementById('free-del-msg');
    
    if (spinResultText.toLowerCase().includes("free delivery") || spinResultText === spinSettings.tier2) {
        deliveryCharge = 0;
        if (freeDelMsg) {
            freeDelMsg.style.display = 'block'; 
            freeDelMsg.style.color = 'green';
            freeDelMsg.innerHTML = `🎡 স্পিন অফার: <b>ফ্রি ডেলিভারি</b> অ্যাপ্লাই হয়েছে!`;
        }
    } else if (isAutoFreeEnabled && threshold > 0 && subtotal >= threshold && subtotal > 0) {
        deliveryCharge = 0; 
        if (freeDelMsg) {
            freeDelMsg.style.display = 'block'; 
            freeDelMsg.style.color = 'green';
            freeDelMsg.innerHTML = `🎉 অভিনন্দন! আপনি <b>ফ্রি ডেলিভারি</b> পাচ্ছেন!`;
        }
    } else if (isAutoFreeEnabled && threshold > 0 && subtotal > 0) {
        let amountNeeded = threshold - subtotal;
        if (freeDelMsg) {
            freeDelMsg.style.display = 'block'; 
            freeDelMsg.style.color = 'var(--brand-color)'; 
            freeDelMsg.innerHTML = `আর মাত্র <b>Tk ${amountNeeded}</b> টাকার শপিং করলেই পাচ্ছেন ফ্রি ডেলিভারি! 🚚`;
        }
    } else {
        if (freeDelMsg) freeDelMsg.style.display = 'none';
    }

    if (subtotal === 0) deliveryCharge = 0;
    if(document.getElementById('cart-delivery')) document.getElementById('cart-delivery').innerText = deliveryCharge;
    
    spinDiscountAmount = 0;
    if(spinResultText.includes('%')) {
        let percentage = parseInt(spinResultText.replace(/\D/g,''));
        if(!isNaN(percentage)) {
            spinDiscountAmount = Math.round(subtotal * (percentage / 100));
        }
    }

    let grandTotal = subtotal + deliveryCharge - promoDiscountAmount - spinDiscountAmount;
    if(grandTotal < 0) grandTotal = 0; 
    
    if(document.getElementById('cart-total')) {
        let discountHtml = '';
        if(promoDiscountAmount > 0) discountHtml += `<br><small style="color:green; font-size:12px;">(Promo: -Tk ${promoDiscountAmount})</small>`;
        if(spinDiscountAmount > 0) discountHtml += `<br><small style="color:var(--brand-color); font-size:12px;">(Spin Bonus: -Tk ${spinDiscountAmount})</small>`;
        
        document.getElementById('cart-total').innerHTML = `${grandTotal} ${discountHtml}`;
    }
}

window.changeQty = function(index, delta) {
    cart[index].qty += delta;
    if(cart[index].qty <= 0) cart.splice(index, 1);
    updateCartUI();
};

const deliveryZoneEl = document.getElementById('delivery_zone');
if(deliveryZoneEl) deliveryZoneEl.addEventListener('change', updateCartUI);

const applyPromoBtn = document.getElementById('apply_promo_btn');
if(applyPromoBtn) {
    applyPromoBtn.addEventListener('click', async () => {
        if(cart.length === 0) return alert("Cart is empty!");
        const codeInput = document.getElementById('promo_input').value.trim().toUpperCase();
        const msg = document.getElementById('promo_msg');
        
        if(codeInput === "") return;
        
        try {
            const promoSnap = await getDoc(doc(db, "promocodes", codeInput));
            if (promoSnap.exists()) {
                promoDiscountAmount = parseInt(promoSnap.data().discountAmount) || 0;
                appliedPromoCode = codeInput;
                if(msg) {
                    msg.innerText = `✅ Promo Applied! (Discount: Tk ${promoDiscountAmount})`;
                    msg.style.color = "green";
                }
                updateCartUI();
            } else {
                if(msg) {
                    msg.innerText = "❌ Invalid or Expired Promo Code!";
                    msg.style.color = "red";
                }
                promoDiscountAmount = 0;
                appliedPromoCode = "";
                updateCartUI();
            }
        } catch (e) { console.error("Promo error", e); }
    });
}

const modal = document.getElementById("checkout-modal");
const cartBtn = document.getElementById("cart-btn");
const closeModalBtn = document.getElementById("close-modal");

if(cartBtn && modal) {
    cartBtn.onclick = () => { 
        updateCartUI(); 
        modal.style.display = "block"; 
        document.body.classList.add('modal-open'); 
    };
}
if(closeModalBtn && modal) {
    closeModalBtn.onclick = () => { 
        modal.style.display = "none"; 
        document.body.classList.remove('modal-open'); 
    };
}

document.querySelectorAll('input[name="payment"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const instBox = document.getElementById('payment-instruction-box');
        const pNum = document.getElementById('pay-number');
        const pMethodName = document.getElementById('pay-method-name');
        const trxInput = document.getElementById('c_trxid');
        
        if(this.value === 'COD') {
            if(instBox) instBox.style.display = 'none';
            if(trxInput) { trxInput.required = false; trxInput.value = ''; }
        } else {
            if(instBox) instBox.style.display = 'block';
            if(trxInput) trxInput.required = true;
            if(pMethodName) pMethodName.innerText = this.value;

            if(pNum) {
                if(this.value === 'bKash') pNum.innerText = window.paymentNumbers.bkash || 'নাম্বার দেওয়া নেই';
                else if(this.value === 'Nagad') pNum.innerText = window.paymentNumbers.nagad || 'নাম্বার দেওয়া নেই';
                else if(this.value === 'Rocket') pNum.innerText = window.paymentNumbers.rocket || 'নাম্বার দেওয়া নেই';
            }
        }
    });
});

function isSpinCooldownActive() {
    const lastSpinTime = localStorage.getItem('ebong_last_spin_time');
    if (!lastSpinTime) return false;
    
    const now = new Date().getTime();
    const diffHours = (now - parseInt(lastSpinTime)) / (1000 * 60 * 60);
    return diffHours < 24; 
}

const openSpinBtn = document.getElementById('open-spin-modal-btn');
const spinModal = document.getElementById('spin-wheel-modal');
const closeSpinBtn = document.getElementById('close-spin-modal');
const startSpinBtn = document.getElementById('start-spin-btn');
const wheelCircle = document.getElementById('spin-wheel-circle');
const spinMsg = document.getElementById('spin_result_msg');

// ⭐ UPDATE: Open gamified spin wheel from header
const headerSpinBtnClick = document.getElementById('header-spin-btn');
if(headerSpinBtnClick && spinModal) {
    headerSpinBtnClick.onclick = () => {
        if(window.customerSpinTickets <= 0) {
            alert("Oops! You don't have any Spin Tickets. Place an order to earn tickets!");
            return;
        }
        spinModal.style.display = 'block';
        document.body.classList.add('modal-open');
    }
}

if(openSpinBtn && spinModal) {
    openSpinBtn.onclick = () => { 
        if(!hasSpun && !isSpinCooldownActive()) {
            spinModal.style.display = 'block'; 
        }
    };
}
if(closeSpinBtn) {
    closeSpinBtn.onclick = () => { 
        spinModal.style.display = 'none'; 
        document.body.classList.remove('modal-open');
    }
}

if(startSpinBtn) {
    startSpinBtn.onclick = () => {
        if(hasSpun || isSpinCooldownActive()) {
            alert("You have already used your spin for today. Please try again tomorrow!");
            return;
        }

        let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        let prize = "0% / Better Luck Next Time"; 
        
        if (subtotal > 0 && subtotal < 950) prize = spinSettings.tier1 || "5% Discount";
        else if (subtotal >= 950 && subtotal <= 2500) prize = spinSettings.tier2 || "Free Delivery";
        else if (subtotal >= 2601 && subtotal <= 4500) prize = spinSettings.tier3 || "10% Discount";
        else if (subtotal >= 4501 && subtotal <= 5000) prize = spinSettings.tier4 || "12% Discount";
        else if (subtotal >= 5100 && subtotal <= 10000) prize = spinSettings.tier5 || "Free Sunglass";
        else if (subtotal > 10000) prize = spinSettings.tier6 || "17% Discount";

        startSpinBtn.disabled = true;
        startSpinBtn.innerText = "Spinning...";
        
        let randomDegree = Math.floor(Math.random() * 360) + (360 * 5); 
        wheelCircle.style.transform = `rotate(${randomDegree}deg)`;

        setTimeout(() => {
            spinResultText = prize;
            hasSpun = true;
            
            localStorage.setItem('ebong_last_spin_time', new Date().getTime().toString());
            
            alert(`🎉 Congratulations! You won: ${prize}`);
            
            if(spinMsg) {
                spinMsg.innerHTML = `✅ Reward Applied: <b>${prize}</b>`;
                spinMsg.style.color = 'var(--brand-color)';
            }
            
            spinModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            updateCartUI(); 
            
        }, 4000); 
    };
}

// ==========================================
// ⭐ NEW: ORDER SUBMISSION & TRACKING ID GEN
// ==========================================
const orderForm = document.getElementById('order-form');
if(orderForm) {
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if(cart.length === 0) return alert("Add products first.");
        const btn = e.target.querySelector('button'); 
        if(btn) { btn.innerText = "Processing..."; btn.disabled = true; }
        
        let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        let deliverySelect = document.getElementById('delivery_zone');
        let baseDeliveryCharge = deliverySelect ? parseInt(deliverySelect.value) : 0;
        
        let threshold = window.deliveryRates.freeThreshold;
        let isAutoFreeEnabled = window.deliveryRates.autoFreeEnabled; 
        
        let deliveryCharge = baseDeliveryCharge;
        
        if (spinResultText.toLowerCase().includes("free delivery") || spinResultText === spinSettings.tier2) {
            deliveryCharge = 0; 
        } else if (isAutoFreeEnabled && threshold > 0 && subtotal >= threshold) {
            deliveryCharge = 0;
        }
        
        let grandTotal = subtotal + deliveryCharge - promoDiscountAmount - spinDiscountAmount;
        if(grandTotal < 0) grandTotal = 0;

        let trxElement = document.getElementById('c_trxid');
        let phoneInput = document.getElementById('c_phone').value.trim();

        // Generate Tracking ID (Last 5 digits + logic for duplicates)
        let baseTrackingId = phoneInput.length >= 5 ? phoneInput.slice(-5) : Math.floor(10000 + Math.random() * 90000).toString();
        let finalTrackingId = baseTrackingId;
        
        try {
            // Check if tracking ID already exists and append A, B, C...
            const q = query(collection(db, "orders"), where("trackingIdBase", "==", baseTrackingId));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const count = querySnapshot.size;
                const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const suffix = alphabet[(count - 1) % 26]; 
                finalTrackingId = baseTrackingId + "-" + suffix;
            }

            let orderData = {
                trackingId: finalTrackingId, // ⭐ NEW
                trackingIdBase: baseTrackingId, // ⭐ NEW
                customerName: document.getElementById('c_name').value,
                phone: phoneInput,
                address: document.getElementById('c_address').value,
                paymentMethod: document.querySelector('input[name="payment"]:checked').value,
                trxId: (trxElement && trxElement.value) ? trxElement.value : "N/A",
                items: cart, 
                promoCodeApplied: appliedPromoCode || "None", 
                discountReceived: promoDiscountAmount + spinDiscountAmount, 
                spinPrize: spinResultText || "None",
                deliveryCharge: deliveryCharge, // For PDF
                totalAmount: grandTotal, 
                status: "Pending",
                date: new Date().toLocaleString(),
                stockDeducted: false 
            };

            if (currentCustomer) {
                orderData.customerId = currentCustomer.uid;
            }

            const newOrderRef = await addDoc(collection(db, "orders"), orderData);
            
            // ⭐ Show Success Modal with Tracking ID
            document.getElementById('checkout-modal').style.display = 'none';
            const successModal = document.getElementById('success-modal');
            document.getElementById('success-tracking-id').innerText = finalTrackingId;
            successModal.style.display = 'block';

            // Prepare PDF Template Data (Hidden)
            preparePDFInvoice(orderData, finalTrackingId);

            // Reset Everything
            cart = []; 
            promoDiscountAmount = 0; 
            appliedPromoCode = ""; 
            spinResultText = "";
            spinDiscountAmount = 0;
            hasSpun = false; 
            
            if(document.getElementById('promo_input')) document.getElementById('promo_input').value = "";
            if(document.getElementById('promo_msg')) document.getElementById('promo_msg').innerText = "";
            if(spinMsg) spinMsg.innerText = "";
            
            updateCartUI(); 
            document.getElementById('order-form').reset();
            
            const instBox = document.getElementById('payment-instruction-box');
            if(instBox) instBox.style.display = 'none';

        } catch (error) { 
            console.error("Order submission error:", error);
            alert("Error: " + error.message); 
        } 
        finally { 
            if(btn) { btn.innerText = "Confirm Order"; btn.disabled = false; }
        }
    });
}

// ==========================================
// ⭐ NEW: IMAGE INVOICE GENERATOR LOGIC (SCROLL ISSUE FIXED)
// ==========================================
function preparePDFInvoice(order, trackingId) {
    document.getElementById('pdf-tracking-id').innerText = trackingId;
    document.getElementById('pdf-date').innerText = order.date;
    document.getElementById('pdf-name').innerText = order.customerName;
    document.getElementById('pdf-phone').innerText = order.phone;
    document.getElementById('pdf-address').innerText = order.address;
    
    let itemsHtml = order.items.map(i => `
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333;">
                <strong>${i.name}</strong><br>
                <span style="font-size:12px; color:#666;">Code: ${i.code || 'N/A'} | Size: ${i.size} | Color: ${i.color}</span>
            </td>
            <td style="text-align:center; padding: 10px; border-bottom: 1px solid #eee; color: #333;">${i.qty}</td>
            <td style="text-align:right; padding: 10px; border-bottom: 1px solid #eee; color: #333;">Tk ${i.price * i.qty}</td>
        </tr>
    `).join('');
    
    document.getElementById('pdf-items').innerHTML = itemsHtml;
    
    let discountVal = order.discountReceived || 0;
    if(discountVal > 0) document.getElementById('pdf-discount').innerText = `Discount: -Tk ${discountVal}`;
    else document.getElementById('pdf-discount').innerText = '';

    if(order.spinPrize && order.spinPrize !== "None") document.getElementById('pdf-spin').innerText = `Spin Prize: ${order.spinPrize}`;
    else document.getElementById('pdf-spin').innerText = '';

    document.getElementById('pdf-delivery').innerText = order.deliveryCharge || 0;
    document.getElementById('pdf-total').innerText = order.totalAmount;
    document.getElementById('pdf-method').innerText = order.paymentMethod;
    
    const isPaid = order.paymentMethod !== "COD";
    document.getElementById('pdf-status').innerHTML = isPaid ? "<span style='color:green'>PAID</span>" : "<span style='color:red'>DUE ON DELIVERY</span>";
}

// ⭐ FIX: PERFECT SCREENSHOT FOR MOBILE AND DESKTOP
window.downloadCustomerInvoicePicture = function() {
    const element = document.getElementById('invoice-template');
    const parent = element.parentElement;
    
    // Bring invoice to top to avoid scroll blank space issues but keep it hidden
    parent.style.display = 'block'; 
    parent.style.position = 'fixed'; 
    parent.style.top = '0';
    parent.style.left = '0';
    parent.style.zIndex = '99999'; // Bring it completely to the front
    parent.style.opacity = '1'; // Must be 1 to capture image properly
    
    element.style.fontFamily = "Arial, sans-serif"; 
    
    const trackingId = document.getElementById('pdf-tracking-id').innerText;

    // Small delay to ensure mobile browser paints the UI
    setTimeout(() => {
        html2canvas(element, { 
            scale: 2, 
            useCORS: true,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            scrollY: -window.scrollY // ⭐ ABSOLUTE FIX FOR SCROLL OFFSET
        }).then(canvas => {
            let link = document.createElement('a');
            link.download = `eBong_Invoice_${trackingId}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            
            // Hide again
            parent.style.display = 'none'; 
            parent.style.position = 'static';
            parent.style.zIndex = 'auto';
        }).catch(err => {
            console.error("Screenshot error:", err);
            alert("Failed to download image. Try again.");
            parent.style.display = 'none';
        });
    }, 500);
}


// ==========================================
// ⭐ NEW: LIVE ORDER TRACKING LOGIC
// ==========================================
window.trackOrder = async function() {
    const input = document.getElementById('track-id-input').value.trim().toUpperCase();
    if(!input) return alert("Please enter a Tracking ID or Last 5 digits of your phone.");

    const btn = document.querySelector('.tracker-btn');
    btn.innerText = "Searching...";

    try {
        let q = query(collection(db, "orders"), where("trackingId", "==", input));
        let querySnapshot = await getDocs(q);

        // Fallback: Check if they just entered the base 5 digits and want the latest one
        if (querySnapshot.empty && input.length === 5) {
            q = query(collection(db, "orders"), where("trackingIdBase", "==", input));
            querySnapshot = await getDocs(q);
        }

        const resultBox = document.getElementById('tracker-result');
        const timeline = document.getElementById('tracking-timeline');

        if (querySnapshot.empty) {
            alert("No active order found with this ID.");
            resultBox.style.display = 'none';
        } else {
            // Get the most recent order if multiple exist for the base ID
            let orders = [];
            querySnapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
            orders.sort((a, b) => new Date(b.date) - new Date(a.date));
            let order = orders[0];

            if(order.status === "Deleted") {
                alert("This order has been cancelled or deleted.");
                resultBox.style.display = 'none';
                return;
            }

            document.getElementById('t-id').innerText = order.trackingId || order.id.substring(0,6);
            document.getElementById('t-status-badge').innerText = order.status;

            // Set badge color based on status
            const badge = document.getElementById('t-status-badge');
            if(order.status === "Pending") badge.style.background = "orange";
            if(order.status === "Confirmed") badge.style.background = "#007bff";
            if(order.status === "Processing") badge.style.background = "#6f42c1";
            if(order.status === "Shipped") badge.style.background = "#17a2b8";
            if(order.status === "Out for Delivery") badge.style.background = "#e83e8c";
            if(order.status === "Delivered") badge.style.background = "#28a745";

            // Build Timeline
            const steps = ["Pending", "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered"];
            let currentStepIdx = steps.indexOf(order.status);
            if(currentStepIdx === -1) currentStepIdx = 0; // Default

            let html = '';
            steps.forEach((step, idx) => {
                let liClass = '';
                let dateTxt = '';

                if (idx < currentStepIdx) {
                    liClass = 'completed';
                    dateTxt = 'Completed';
                } else if (idx === currentStepIdx) {
                    liClass = 'active';
                    dateTxt = `Updated: ${order.confirmedAt || order.date || 'Recently'}`;
                } else {
                    dateTxt = 'Pending...';
                }

                // Attach Admin Note to the current active step
                let noteHtml = '';
                if (idx === currentStepIdx && order.adminNote) {
                    noteHtml = `<div style="margin-top: 5px; background: var(--bg-light-grey); padding: 5px 10px; border-radius: 5px; border: 1px dashed var(--brand-color); font-size: 11px; color: var(--brand-color);">📝 Note: ${order.adminNote}</div>`;
                }

                html += `
                    <li class="${liClass}">
                        <h4>${step}</h4>
                        <p>${dateTxt}</p>
                        ${noteHtml}
                    </li>
                `;
            });

            timeline.innerHTML = html;
            resultBox.style.display = 'block';
        }
    } catch(e) { console.error("Tracking Error:", e); alert("System error while tracking."); }
    finally { btn.innerText = "Track Status"; }
}


// ==========================================
// ⭐ LIVE REVIEWS REAL-TIME LOGIC
// ==========================================
async function loadReviews() {
    const reviewsContainer = document.getElementById('reviews-container');
    if(!reviewsContainer) return;

    onSnapshot(collection(db, "reviews"), (snapshot) => {
        let reviewsHtml = '';
        let reviews = [];
        
        snapshot.forEach((doc) => {
            let data = doc.data();
            if(data.status === "Approved") {
                reviews.push(data);
            }
        });

        if (reviews.length === 0) {
            reviewsContainer.innerHTML = '<p style="text-align:center; width:100%; color: var(--text-light);">No reviews yet. Be the first to review!</p>';
            return;
        }

        reviews.reverse();

        reviews.forEach(review => {
            let stars = '⭐'.repeat(parseInt(review.rating)) + '☆'.repeat(5 - parseInt(review.rating));
            reviewsHtml += `
                <div style="background: var(--bg-card); padding: 20px; border-radius: 10px; border: 1px solid var(--border-color); box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <strong style="font-size: 16px; color: var(--brand-color);">👤 ${review.name}</strong>
                        <span style="color: #ffb800; font-size: 14px;">${stars}</span>
                    </div>
                    <p style="font-size: 14px; color: var(--text-dark); margin: 0; font-style: italic; line-height: 1.5;">"${review.text}"</p>
                    <small style="display:block; margin-top:12px; color: var(--text-light); font-size: 12px;">🕒 ${review.date}</small>
                </div>
            `;
        });
        reviewsContainer.innerHTML = reviewsHtml;
    }, (error) => {
        console.error("Error loading live reviews:", error);
    });
}

const reviewForm = document.getElementById('review-form');
if(reviewForm) {
    reviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.innerText = "Submitting..."; btn.disabled = true;

        try {
            await addDoc(collection(db, "reviews"), {
                name: document.getElementById('r_name').value,
                rating: document.getElementById('r_rating').value,
                text: document.getElementById('r_text').value,
                date: new Date().toLocaleDateString(),
                status: "Pending" 
            });
            alert("🎉 Thank you! Your review has been submitted and is waiting for admin approval.");
            reviewForm.reset();
            
            document.getElementById('review-modal').style.display = 'none';
            document.body.classList.remove('modal-open');
        } catch (error) {
            alert("Error submitting review: " + error.message);
        } finally {
            btn.innerText = "Submit Review"; btn.disabled = false;
        }
    });
}


// ==========================================
// 💬 NEW: LIVE CHAT SYSTEM
// ==========================================
let sessionId = localStorage.getItem('ebong_chat_session');
let chatListenerUnsubscribe = null;

function initCustomerChat() {
    const preFormContainer = document.getElementById('pre-chat-form-container');
    const activeChatInterface = document.getElementById('active-chat-interface');
    const msgBox = document.getElementById('user-messages-box');
    const badge = document.getElementById('user-chat-badge');

    if (!sessionId) {
        if(preFormContainer) preFormContainer.style.display = 'flex';
        if(activeChatInterface) activeChatInterface.style.display = 'none';
        return;
    }
    
    if(preFormContainer) preFormContainer.style.display = 'none';
    if(activeChatInterface) activeChatInterface.style.display = 'flex';

    const chatRef = doc(db, "live_chats", sessionId);
    
    chatListenerUnsubscribe = onSnapshot(chatRef, (docSnap) => {
        if (docSnap.exists()) {
            const chatData = docSnap.data();
            
            if(chatData.status === "closed") {
                if(msgBox) {
                    msgBox.innerHTML += `<div class="msg-system" style="color:red; font-weight:bold;">This chat has been ended. Please start a new chat if you need further assistance.</div>`;
                    msgBox.scrollTop = msgBox.scrollHeight;
                }
                const inputBtn = document.getElementById('user-chat-input');
                if(inputBtn) inputBtn.disabled = true;
                
                localStorage.removeItem('ebong_chat_session');
                sessionId = null;
                if(chatListenerUnsubscribe) chatListenerUnsubscribe(); 
                return;
            }

            const chatBox = document.getElementById('custom-chat-box');
            if (chatData.userUnread > 0 && chatBox.style.display !== 'flex') {
                if(badge) {
                    badge.innerText = chatData.userUnread;
                    badge.style.display = 'flex';
                }
            } else if (chatBox.style.display === 'flex' && chatData.userUnread > 0) {
                updateDoc(chatRef, { userUnread: 0 });
                if(badge) badge.style.display = 'none';
            }

            if(msgBox && chatData.messages) {
                let msgsHtml = '<div class="msg-system">Welcome to eBong! How can we help you today?</div>';
                
                chatData.messages.forEach(msg => {
                    const isUser = msg.sender === 'user';
                    const bubbleClass = isUser ? 'msg-user' : 'msg-admin';
                    
                    let timeStr = "";
                    if(msg.timestamp) {
                        const d = new Date(msg.timestamp);
                        timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    }

                    let senderNameHtml = '';
                    if(!isUser && msg.adminName) {
                        senderNameHtml = `<strong style="font-size:11px; display:block; margin-bottom:3px; color:var(--text-dark);">Support: ${msg.adminName}</strong>`;
                    }

                    msgsHtml += `
                        <div class="chat-msg ${bubbleClass}">
                            ${senderNameHtml}
                            ${msg.text}
                            <span style="display:block; text-align:right; font-size:9px; margin-top:4px; opacity:0.8;">${timeStr}</span>
                        </div>
                    `;
                });
                msgBox.innerHTML = msgsHtml;
                msgBox.scrollTop = msgBox.scrollHeight;
            }
        }
    });
}

window.startCustomerChat = async function() {
    const nameInput = document.getElementById('pre-chat-name');
    const phoneInput = document.getElementById('pre-chat-phone');
    
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if(!name || !phone) {
        alert("Please enter your Name and Phone Number to start chatting.");
        return;
    }

    sessionId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('ebong_chat_session', sessionId);

    const autoGreetingMsg = {
        sender: "admin",
        adminName: "eBong Bot",
        text: `হ্যালো ${name}, অনুগ্রহ করে আপনার সমস্যাটি জানান। আমাদের টিম দ্রুত যোগাযোগ করবে।\nপ্রয়োজনে কল করুন: +8801572-921697`,
        timestamp: new Date().getTime()
    };

    try {
        await setDoc(doc(db, "live_chats", sessionId), {
            customerName: name,
            customerPhone: phone,
            messages: [autoGreetingMsg],
            status: "active",
            adminUnread: 0,
            userUnread: 1, 
            lastUpdated: new Date().getTime()
        });

        document.getElementById('pre-chat-form-container').style.display = 'none';
        document.getElementById('active-chat-interface').style.display = 'flex';
        
        initCustomerChat();
        
        setTimeout(() => {
            const input = document.getElementById('user-chat-input');
            if(input) {
                input.disabled = false;
                input.focus();
            }
        }, 100);

    } catch (e) {
        console.error("Error starting chat: ", e);
        alert("Could not connect to chat server. Please try again.");
    }
}

window.openChatBox = async function() {
    const chatBox = document.getElementById('custom-chat-box');
    const badge = document.getElementById('user-chat-badge');
    
    if (chatBox.style.display === 'flex') {
        chatBox.style.display = 'none';
    } else {
        chatBox.style.display = 'flex';
        if(badge) badge.style.display = 'none';
        
        if(sessionId) {
            const chatRef = doc(db, "live_chats", sessionId);
            const chatSnap = await getDoc(chatRef);
            if(chatSnap.exists() && chatSnap.data().userUnread > 0) {
                await updateDoc(chatRef, { userUnread: 0 });
            }
            
            setTimeout(() => {
                const input = document.getElementById('user-chat-input');
                if(input && !input.disabled) input.focus();
            }, 100);
        }
    }
}

window.sendUserMessage = async function() {
    const inputEl = document.getElementById('user-chat-input');
    if (!inputEl || inputEl.disabled) return;
    
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = ''; 

    const chatRef = doc(db, "live_chats", sessionId);
    const chatSnap = await getDoc(chatRef);
    
    const newMsg = {
        sender: "user",
        text: text,
        timestamp: new Date().getTime()
    };

    if (chatSnap.exists()) {
        let messages = chatSnap.data().messages || [];
        messages.push(newMsg);

        await updateDoc(chatRef, { 
            messages: messages,
            status: "active", 
            adminUnread: (chatSnap.data().adminUnread || 0) + 1,
            lastUpdated: new Date().getTime()
        });
    } 
}

window.handleUserChatEnter = function(event) {
    if (event.key === 'Enter') {
        sendUserMessage();
    }
}

window.endChatByUser = async function() {
    if(confirm("Are you sure you want to end this chat?")) {
        const chatRef = doc(db, "live_chats", sessionId);
        try {
            const snap = await getDoc(chatRef);
            if(snap.exists()) {
                await updateDoc(chatRef, { 
                    status: "closed",
                    closedBy: "User",
                    closedAt: new Date().getTime()
                });
            }
            document.getElementById('custom-chat-box').style.display = 'none';
            localStorage.removeItem('ebong_chat_session');
            sessionId = null;
            if(chatListenerUnsubscribe) chatListenerUnsubscribe();
            
            document.getElementById('active-chat-interface').style.display = 'none';
            document.getElementById('pre-chat-form-container').style.display = 'flex';
            document.getElementById('pre-chat-name').value = '';
            document.getElementById('pre-chat-phone').value = '';
            
        } catch(e) { console.log(e); }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const chatToggle = document.getElementById('open-chat-modal');
    if(chatToggle) chatToggle.onclick = openChatBox;
    
    const endChatBtn = document.getElementById('end-chat-user-btn');
    if(endChatBtn) endChatBtn.onclick = endChatByUser;
});

// Fake Sales Popup Logic
function startFakeSalesNotifications() {
    const popup = document.getElementById('sales-popup');
    if (!popup) return;

    const names = ["Rahim", "Karim", "Ayesha", "Sumaiya", "Rakib", "Tariq", "Nusrat", "Hasan", "Mehedi", "Sadia"];
    const cities = ["Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna", "Barishal", "Rangpur", "Cumilla", "Gazipur", "Narayanganj"];
    
    function showPopup() {
        if (!window.salesPopupEnabled) return; 

        if (window.allProductsList.length === 0) {
            setTimeout(showPopup, 5000);
            return;
        }

        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomCity = cities[Math.floor(Math.random() * cities.length)];
        const randomProduct = window.allProductsList[Math.floor(Math.random() * window.allProductsList.length)];
        const randomTime = Math.floor(Math.random() * 15) + 1;

        document.getElementById('sp-name').innerText = randomName;
        document.getElementById('sp-city').innerText = randomCity;
        document.getElementById('sp-product').innerText = randomProduct.name || "Premium Product";
        document.getElementById('sp-time').innerText = `${randomTime} minutes ago`;

        const imgEl = document.getElementById('sp-img');
        if (randomProduct.image_url) {
            imgEl.src = randomProduct.image_url;
            imgEl.style.display = "block";
        } else if (randomProduct.images && randomProduct.images.length > 0) {
            let safeUrl = randomProduct.images[0].trim();
            if (safeUrl && !safeUrl.startsWith('http') && !safeUrl.startsWith('data:')) {
                safeUrl = 'data:image/jpeg;base64,' + safeUrl;
            }
            imgEl.src = safeUrl;
            imgEl.style.display = "block";
        } else {
            imgEl.style.display = "none";
        }

        popup.classList.add('show');

        setTimeout(() => {
            popup.classList.remove('show');
        }, 5000);

        const nextTime = Math.floor(Math.random() * 30000) + 15000;
        setTimeout(showPopup, nextTime);
    }

    setTimeout(showPopup, 10000);
}

window.filterGlobalProducts = function() {
    let input = document.getElementById('main-search-bar').value.toLowerCase();
    let productCards = document.querySelectorAll('.product-card');

    productCards.forEach(card => {
        let name = card.querySelector('.product-name').innerText.toLowerCase();
        let category = card.closest('.category-section').querySelector('h2').innerText.toLowerCase();
        
        if (name.includes(input) || category.includes(input)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });

    document.querySelectorAll('.category-section').forEach(section => {
        let visibleCards = section.querySelectorAll('.product-card[style="display: block;"]');
        if(visibleCards.length === 0 && input !== "") {
            section.style.display = 'none';
        } else {
            section.style.display = 'block';
        }
    });
}

window.onload = () => { 
    console.log("Window Loaded. Initializing app...");
    loadSettings(); 
    loadProducts(); 
    loadReviews();
    startFakeSalesNotifications();
    initCustomerChat(); 
};