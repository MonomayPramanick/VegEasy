document.querySelectorAll('.btn-add').forEach(button => {
    button.addEventListener('click', async function () {
        try {
            const response = await fetch('/user-id'); // Fetch user ID from server
            const data = await response.json();
            const userId = data.userId; // Retrieve user ID

            if (!userId) {
                alert('You need to be logged in to add items to the cart.');
                return;
            }

            const productId = this.closest('.product-card').getAttribute('data-product-id');
            
            const res = await fetch('/cart/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, userId })
            });

            const result = await res.json();
            if (res.ok) {
                alert('Item added to cart successfully!');
            } else {
                console.error(result.message);
            }
        } catch (error) {
            console.error('Error adding item to cart:', error);
        }
    });
});
