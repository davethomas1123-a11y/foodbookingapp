'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useToast } from '@/hooks/use-toast';
import { Trash2, ShoppingBasket, Plus, Minus, Frown, CheckCircle, MessageSquare, Eraser } from 'lucide-react';
import Link from 'next/link';

type Order = {
  id: string;
  foodItemId: string;
  quantity: number;
  price: number;
  totalPrice: number;
  status: 'draft' | 'pending' | 'fulfilled';
  comment?: string;
};

type FoodItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
};

type CartItem = Order & {
  foodItem: FoodItem;
};

export default function CartPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const foodItemsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'foodItems')) : null),
    [firestore]
  );
  const { data: foodItems, isLoading: foodItemsLoading } = useCollection<FoodItem>(foodItemsQuery);

  const draftOrdersQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(collection(firestore, 'customers', user.uid, 'orders'), where('status', '==', 'draft'))
        : null,
    [user, firestore]
  );
  const { data: draftOrders, isLoading: ordersLoading } = useCollection<Order>(draftOrdersQuery);

  const cartItems: CartItem[] = useMemo(() => {
    if (!draftOrders || !foodItems) return [];
    return draftOrders
      .map((order) => {
        const foodItem = foodItems.find((item) => item.id === order.foodItemId);
        return foodItem ? { ...order, foodItem } : null;
      })
      .filter((item): item is CartItem => item !== null)
      .sort((a,b) => a.foodItem.name.localeCompare(b.foodItem.name));
  }, [draftOrders, foodItems]);

  const total = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [cartItems]);

  const handleQuantityChange = async (orderId: string, currentQuantity: number, price: number, delta: number) => {
    const newQuantity = currentQuantity + delta;
    if (!user || !firestore) return;
    
    setIsUpdating(true);
    const orderRef = doc(firestore, 'customers', user.uid, 'orders', orderId);
    
    try {
      if (newQuantity < 1) {
        await deleteDoc(orderRef);
        toast({
          title: 'Item Removed',
          description: 'The item has been removed from your cart.',
        });
      } else {
        await updateDoc(orderRef, {
          quantity: newQuantity,
          totalPrice: newQuantity * price,
        });
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update item quantity.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveItem = async (orderId: string) => {
    if (!user || !firestore) return;
    setIsUpdating(true);
    const orderRef = doc(firestore, 'customers', user.uid, 'orders', orderId);
    try {
      await deleteDoc(orderRef);
      toast({
        title: 'Item Removed',
        description: 'The item has been removed from your cart.',
      });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        variant: 'destructive',
        title: 'Removal Failed',
        description: 'Could not remove the item.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmOrder = async () => {
    if (!user || !firestore || cartItems.length === 0) return;
    
    setIsConfirming(true);
    const batch = writeBatch(firestore);

    cartItems.forEach(item => {
      const orderRef = doc(firestore, 'customers', user.uid, 'orders', item.id);
      batch.update(orderRef, { status: 'pending' });
    });

    try {
      await batch.commit();
      toast({
        title: 'Order Confirmed!',
        description: "Your reservation has been sent to the admin for fulfillment.",
      });
      // The cart will automatically empty as the items no longer have 'draft' status
    } catch (error) {
      console.error("Failed to confirm order: ", error);
      toast({
        title: 'Confirmation Failed',
        description: 'There was an issue confirming your order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClearCart = async () => {
    if (!user || !firestore || !draftOrders || draftOrders.length === 0) return;

    setIsUpdating(true);
    const batch = writeBatch(firestore);
    const ordersCollectionRef = collection(firestore, 'customers', user.uid, 'orders');
    
    try {
      // Re-fetch draft orders within the function to ensure we have the latest list
      const draftOrdersSnapshot = await getDocs(query(ordersCollectionRef, where('status', '==', 'draft')));
      
      if (draftOrdersSnapshot.empty) {
        toast({ title: 'Cart is already empty' });
        setIsUpdating(false);
        return;
      }

      draftOrdersSnapshot.forEach(orderDoc => {
        batch.delete(orderDoc.ref);
      });

      await batch.commit();
      toast({
        title: 'Cart Cleared',
        description: 'All items have been removed from your cart.',
      });
    } catch (error) {
      console.error("Error clearing cart: ", error);
      toast({
        variant: 'destructive',
        title: 'Clear Failed',
        description: 'Could not clear your cart. Please try again.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

   if (isUserLoading || foodItemsLoading || ordersLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
     router.push('/login');
     return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <div className="mx-auto bg-primary/20 text-primary p-3 rounded-full w-fit mb-4">
          <ShoppingBasket className="h-8 w-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-headline font-bold">My Cart</h1>
        <p className="text-muted-foreground mt-2">
          Review your items before confirming your reservation.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Your Items</CardTitle>
            <CardDescription>
              You have {cartItems.length} item(s) in your cart.
            </CardDescription>
          </div>
           <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={cartItems.length === 0 || isUpdating || isConfirming}
              >
                <Eraser className="mr-2 h-4 w-4" />
                Clear Cart
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all items from your cart. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearCart}>
                  Confirm &amp; Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          {cartItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden md:table-cell">Item</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-center">Quantity</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="hidden md:table-cell">
                      <Image
                        src={item.foodItem.imageUrl || `https://picsum.photos/seed/${item.foodItemId}/100/100`}
                        alt={item.foodItem.name}
                        width={64}
                        height={64}
                        className="rounded-md object-cover aspect-square"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.foodItem.name}</div>
                      <div className="text-sm text-muted-foreground">
                        ${item.price.toFixed(2)} each
                      </div>
                      {item.comment && (
                        <div className="flex items-start gap-2 text-muted-foreground pt-2">
                          <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                          <p className="text-xs italic">{item.comment}</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(item.id, item.quantity, item.price, -1)}
                          disabled={isUpdating || isConfirming}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-lg font-bold w-10 text-center">
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleQuantityChange(item.id, item.quantity, item.price, 1)}
                          disabled={isUpdating || isConfirming}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${item.totalPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" disabled={isUpdating || isConfirming}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Item?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove "{item.foodItem.name}" from your cart?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveItem(item.id)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="text-center text-muted-foreground py-16 px-4">
                  <Frown className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium">Your cart is empty</h3>
                  <p className="mt-2 text-sm">Add items from the menu to get started.</p>
                  <Button asChild className="mt-6">
                    <Link href="/">Browse the Menu</Link>
                  </Button>
                </div>
          )}
        </CardContent>
        {cartItems.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/50 p-6 rounded-b-lg">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">Grand Total:</span>
              <span className="text-2xl font-bold">${total.toFixed(2)}</span>
            </div>
            <Button size="lg" onClick={handleConfirmOrder} disabled={isConfirming || isUpdating}>
              {isConfirming ? 'Confirming...' : 'Confirm Order'}
              <CheckCircle className="ml-2 h-5 w-5" />
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

    