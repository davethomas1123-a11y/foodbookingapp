
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  collection,
  query,
  where,
  serverTimestamp,
  getDocs,
  limit,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, UtensilsCrossed, ChevronsDown, Plus, Minus, CircleOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

type FoodItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  reservable: boolean;
};

type AppSettings = {
  logoUrl?: string;
  reservationsOpen?: boolean;
};

export default function HomePage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi>()

  // State for the "Add to Cart" dialog
  const [selectedItem, setSelectedItem] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const foodItemsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'foodItems'), where('reservable', '==', true))
        : null,
    [firestore]
  );
  const { data: foodItems, isLoading: foodItemsLoading } = useCollection<FoodItem>(foodItemsQuery);

  const settingsDocRef = useMemoFirebase(() => (firestore ? doc(firestore, 'settings/app') : null), [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc<AppSettings>(settingsDocRef);
  
  const handleStartBrowsing = () => {
    if (api) {
      api.scrollNext();
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast({
        title: 'Please log in',
        description: 'You need to be logged in to add items to your cart.',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }
    if (!selectedItem) return;

    setAddingItemId(selectedItem.id);

    try {
      if (!firestore) throw new Error("Firestore is not available");

      const ordersRef = collection(firestore, 'customers', user.uid, 'orders');
      const draftOrderQuery = query(
        ordersRef,
        where('foodItemId', '==', selectedItem.id),
        where('status', '==', 'draft'),
        limit(1)
      );
      
      await runTransaction(firestore, async (transaction) => {
        const draftOrderSnapshot = await getDocs(draftOrderQuery);
        
        if (!draftOrderSnapshot.empty) {
          // Item already in cart, update quantity and comment
          const existingOrderDoc = draftOrderSnapshot.docs[0];
          const currentData = existingOrderDoc.data();
          const newQuantity = currentData.quantity + quantity;
          transaction.update(existingOrderDoc.ref, {
            quantity: newQuantity,
            totalPrice: newQuantity * selectedItem.price,
            comment: comment || currentData.comment || null, // Keep existing comment if new one is empty
          });
        } else {
          // Item not in cart, add new order document
          const newOrderRef = doc(ordersRef);
          transaction.set(newOrderRef, {
            customerId: user.uid,
            foodItemId: selectedItem.id,
            quantity: quantity,
            price: selectedItem.price,
            totalPrice: quantity * selectedItem.price,
            status: 'draft',
            timestamp: serverTimestamp(),
            comment: comment || null,
          });
        }
      });

      toast({
        title: 'Added to Cart!',
        description: `${quantity}x ${selectedItem.name} has been added to your cart.`,
      });

    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: 'Error',
        description: 'Could not add item to cart. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAddingItemId(null);
      setIsDialogOpen(false); // Close dialog on success
    }
  };

  // Reset dialog state when it's closed
  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedItem(null);
      setQuantity(1);
      setComment("");
    }
  }

  const reservationsAreOpen = settings?.reservationsOpen !== false;

  if (foodItemsLoading || settingsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-4">
      <Carousel
        className="w-full max-w-xs h-[500px] mt-4"
        setApi={setApi}
        orientation="vertical"
      >
        <CarouselContent className="h-full">
          <CarouselItem className="basis-full">
              <Card className="flex flex-col justify-center items-center text-center h-full">
                <CardHeader className="items-center">
                  <div className="relative w-24 h-24 mb-4">
                      {settings?.logoUrl ? (
                        <Image
                          src={settings.logoUrl}
                          alt="Application Logo"
                          layout="fill"
                          objectFit="contain"
                          className="rounded-md"
                        />
                      ) : (
                        <div className="mx-auto bg-primary/20 text-primary p-3 rounded-full w-fit">
                          <UtensilsCrossed className="h-8 w-8" />
                        </div>
                      )}
                  </div>
                  <CardTitle className="text-3xl font-bold">Food Reservations</CardTitle>
                   <CardDescription className="flex items-center gap-2">
                     Scroll to browse <ChevronsDown className="h-4 w-4" />
                   </CardDescription>
                </CardHeader>
                
                    <Button onClick={handleStartBrowsing}>Start Browsing</Button>
                
              </Card>
          </CarouselItem>

          {reservationsAreOpen && foodItems && foodItems.length > 0 ? (
            foodItems.map((item) => (
              <CarouselItem key={item.id} className="basis-full">
                <Card className="flex flex-col h-full">
                  <div className="relative w-full h-48">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-t-lg"
                    />
                  </div>
                  <CardHeader className="pb-4 flex-grow">
                    <CardTitle>{item.name}</CardTitle>
                    <CardDescription className="pt-2 min-h-[60px]">{item.description}</CardDescription>
                     <div className="flex flex-row items-center justify-between w-full gap-4 mt-2">
                        <Badge variant="default" className="text-lg bg-yellow-400 text-black hover:bg-yellow-500">
                          ${item.price.toFixed(2)}
                        </Badge>

                        <Dialog open={isDialogOpen && selectedItem?.id === item.id} onOpenChange={handleOpenChange}>
                          <DialogTrigger asChild>
                            <Button
                              onClick={() => setSelectedItem(item)}
                              disabled={addingItemId === item.id}
                              className="w-auto"
                            >
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              Add to Cart
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>{selectedItem?.name}</DialogTitle>
                              <DialogDescription>
                                Specify quantity and add any special instructions.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="quantity" className="text-right">
                                  Quantity
                                </Label>
                                <div className="col-span-3 flex items-center gap-2">
                                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
                                  <Input id="quantity" value={quantity} readOnly className="w-12 text-center" />
                                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4" /></Button>
                                </div>
                              </div>
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="comment" className="text-right">
                                  Comment
                                </Label>
                                <Textarea
                                  id="comment"
                                  placeholder="e.g., no onions please"
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  className="col-span-3"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cancel</Button>
                              </DialogClose>
                              <Button
                                onClick={handleAddToCart}
                                disabled={addingItemId === selectedItem?.id}
                              >
                                {addingItemId === selectedItem?.id ? 'Adding...' : `Add ${quantity} to Cart`}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                  </CardHeader>
                </Card>
              </CarouselItem>
            ))
          ) : (
            <CarouselItem className="basis-full">
                <Card className="flex flex-col h-full justify-center items-center text-center">
                   <CardHeader className="items-center">
                    <CircleOff className="h-12 w-12 text-muted-foreground mb-4" />
                    <CardTitle>Reservations Closed</CardTitle>
                    <CardDescription>
                      We are not taking reservations at this time.
                      <br />
                      Please check back later!
                    </CardDescription>
                  </CardHeader>
                </Card>
            </CarouselItem>
          )}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
