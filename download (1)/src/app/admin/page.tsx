
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  collection,
  addDoc,
  query,
  onSnapshot,
  writeBatch,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  Unsubscribe,
  where,
  serverTimestamp,
  collectionGroup,
} from 'firebase/firestore';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Trash2,
  PlusCircle,
  PackageOpen,
  ClipboardList,
  CircleOff,
  Lock,
  Edit,
  CheckCircle2,
  Download,
  MessageSquare,
  Ban,
  Eye,
  BarChart,
  Eraser,
  Store,
  Upload,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Badge } from '@/components/ui/badge';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// Inlined PinEntryForm
const PinFormSchema = z.object({
  pin: z.string().min(1, { message: 'PIN is required.' }),
});

function PinEntryForm({ onCorrectPin, correctPin }: { onCorrectPin: () => void; correctPin: string }) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof PinFormSchema>>({
    resolver: zodResolver(PinFormSchema),
    defaultValues: { pin: '' },
  });

  function onSubmit(data: z.infer<typeof PinFormSchema>) {
    setIsSubmitting(true);
    if (data.pin === correctPin) {
      toast({ title: 'Access Granted', description: 'Welcome to the admin dashboard.' });
      onCorrectPin();
    } else {
      toast({ title: 'Access Denied', description: 'The PIN you entered is incorrect.', variant: 'destructive' });
      form.reset();
    }
    setIsSubmitting(false);
  }

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/20 text-primary p-3 rounded-full w-fit mb-2">
            <Lock className="h-8 w-8" />
          </div>
          <CardTitle className="font-headline text-3xl">Admin Access</CardTitle>
          <CardDescription>Enter the PIN to access the admin dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pin">Admin PIN</Label>
              <Input
                id="pin"
                type="password"
                placeholder="••••"
                className="text-center text-2xl tracking-[0.5em]"
                {...form.register('pin')}
              />
              {form.formState.errors.pin && <p className="text-sm font-medium text-destructive">{form.formState.errors.pin.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : 'Unlock'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
// End Inlined PinEntryForm

type FoodItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  createdAt: any;
  reservable: boolean;
};

type Order = {
  id: string;
  customerId: string;
  foodItemId: string;
  quantity: number;
  timestamp: any;
  totalPrice: number;
  comment?: string;
  status: 'pending' | 'fulfilled' | 'draft';
  [key: string]: any;
};

type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
};

type AppSettings = {
  reservationsOpen?: boolean;
  logoUrl?: string;
};

type CustomerOrders = {
  customer: Customer;
  orders: Order[];
  lastOrderDate: Date;
  totalSpent: number;
};

// Main Admin Page Component
export default function AdminPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAddDialogVali, setIsAddDialogValid] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const [itemToEdit, setItemToEdit] = useState<FoodItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const settingsDocRef = useMemoFirebase(() => (firestore ? doc(firestore, 'settings/app') : null), [firestore]);
  const { data: settings, isLoading: settingsLoading } = useDoc<AppSettings>(settingsDocRef);

  const ADMIN_PIN = '1234';
  const CLOUDINARY_CLOUD_NAME = 'deiahns83';
  const CLOUDINARY_UPLOAD_PRESET = 'foodbooking_upload';

  const weeklyReport = useMemo(() => {
    if (orders.length === 0) {
      return { itemsSold: [], totalRevenue: 0 };
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weeklyOrders = orders.filter(order => order.timestamp && order.timestamp.toDate() > oneWeekAgo && order.status !== 'draft');

    const itemsSold = weeklyOrders.reduce((acc, order) => {
      const foodItem = foodItems.find(item => item.id === order.foodItemId);
      const itemName = foodItem?.name || 'Unknown Item';
      if (!acc[itemName]) {
        acc[itemName] = 0;
      }
      acc[itemName] += order.quantity;
      return acc;
    }, {} as Record<string, number>);

    const totalRevenue = weeklyOrders.reduce((acc, order) => acc + order.totalPrice, 0);

    return { itemsSold: Object.entries(itemsSold), totalRevenue };
  }, [orders, foodItems]);

  const handleSetReservationsOpen = useCallback(
    async (isOpen: boolean) => {
      if (!firestore) return;
      try {
        await setDoc(doc(firestore, 'settings/app'), { reservationsOpen: isOpen }, { merge: true });
      } catch (e) {
        console.error(e);
        toast({ title: 'Error', description: 'Could not update settings.', variant: 'destructive' });
      }
    },
    [firestore, toast]
  );
  
   useEffect(() => {
    const isValid = name.trim() !== '' && description.trim() !== '' && price.trim() !== '' && file !== null;
    setIsAddDialogValid(isValid);
  }, [name, description, price, file]);

  useEffect(() => {
    if (!isAuthorized || !firestore) return;

    // Listener for food items
    const qFood = query(collection(firestore, 'foodItems'));
    const unsubscribeFood = onSnapshot(qFood, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FoodItem));
      setFoodItems(items);
    });

    // Real-time listener for customers
    const qCustomers = query(collection(firestore, 'customers'));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      const customerData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(customerData);
    });

    return () => {
      unsubscribeFood();
      unsubscribeCustomers();
    };
  }, [isAuthorized, firestore]);

  useEffect(() => {
    if (!firestore || customers.length === 0) {
      setOrders([]);
      return;
    }

    const unsubscribers: Unsubscribe[] = [];
    let allOrders: Order[] = [];
    
    customers.forEach(customer => {
      const ordersQuery = query(collection(firestore, 'customers', customer.id, 'orders'));
      const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
        const customerOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        
        // Replace this customer's orders instead of just adding
        allOrders = [
            ...allOrders.filter(o => o.customerId !== customer.id), 
            ...customerOrders
        ];
        setOrders([...allOrders]);
        
      }, (error) => {
        console.error(`Error fetching orders for customer ${customer.id}:`, error);
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [firestore, customers]);


  const customerOrders = useMemo(() => {
    const pendingOrders = orders.filter(o => o.status === 'pending');
    if (pendingOrders.length === 0 || customers.length === 0) return [];
  
    const groupedByCustomer: Record<string, { customer: Customer, orders: Order[] }> = {};
  
    // Find all customers who have pending orders
    const customersWithPendingOrders = customers.filter(c => pendingOrders.some(o => o.customerId === c.id));
  
    // Initialize groups for these customers
    customersWithPendingOrders.forEach(customer => {
        groupedByCustomer[customer.id] = { customer, orders: [] };
    });
  
    // Populate the groups with their pending orders
    pendingOrders.forEach(order => {
      if (groupedByCustomer[order.customerId]) {
        groupedByCustomer[order.customerId].orders.push(order);
      }
    });
  
    // Format the final array
    return Object.values(groupedByCustomer)
      .filter(group => group.orders.length > 0) // Should always be true, but good practice
      .map(group => {
        const sortedOrders = [...group.orders].sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
        const totalSpent = sortedOrders.reduce((acc, order) => acc + (order.totalPrice || 0), 0);
        return {
          ...group,
          orders: sortedOrders,
          lastOrderDate: sortedOrders[0].timestamp.toDate(),
          totalSpent,
        };
      })
      .sort((a, b) => b.lastOrderDate.getTime() - a.lastOrderDate.getTime());
  }, [orders, customers]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (selectedFile) setPreviewUrl(URL.createObjectURL(selectedFile));
    else setPreviewUrl(null);
  };
  
  const resetAddForm = () => {
    setName('');
    setDescription('');
    setPrice('');
    setFile(null);
    setPreviewUrl(null);
    setIsSubmitting(false);
  };

  const handleAddFood = async () => {
    if (!isAddDialogVali || !firestore || !file) {
      toast({ title: 'Missing Fields', description: 'Fill all fields and select an image.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.secure_url) throw new Error('Cloudinary upload failed');

      await addDoc(collection(firestore, 'foodItems'), {
        name,
        description,
        price: parseFloat(price),
        imageUrl: data.secure_url,
        createdAt: new Date(),
        reservable: true,
      });

      toast({ title: 'Food Added', description: `${name} added successfully.` });
      resetAddForm();
      return true; // Indicate success for closing dialog
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to add food item.', variant: 'destructive' });
      setIsSubmitting(false);
      return false; // Indicate failure
    }
  };

  const handleFulfillCustomerOrders = async (customer: Customer) => {
    if (!firestore) return;
    try {
      const ordersToFulfill = orders.filter(o => o.customerId === customer.id && o.status === 'pending');
      
      if (ordersToFulfill.length === 0) {
        toast({ title: 'No Pending Orders', description: 'This customer has no orders to fulfill.' });
        return;
      }

      const batch = writeBatch(firestore);
      ordersToFulfill.forEach((order) => {
        const orderRef = doc(firestore, 'customers', customer.id, 'orders', order.id);
        batch.update(orderRef, { status: 'fulfilled' });
      });
      await batch.commit();

      toast({ title: 'Orders Fulfilled', description: `All pending orders for ${customer.firstName} have been marked as fulfilled.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not fulfill orders.', variant: 'destructive' });
    }
  };

  const handleRemoveItem = async (item: FoodItem) => {
    if (!firestore) return;
    try {
      await deleteDoc(firestore, 'foodItems', item.id);
      toast({ title: 'Item Removed', description: `${item.name} has been removed from the menu.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to remove item.', variant: 'destructive' });
    }
  };
  
  const handleToggleReservable = async (item: FoodItem) => {
    if (!firestore) return;
    try {
      const itemRef = doc(firestore, 'foodItems', item.id);
      await updateDoc(itemRef, { reservable: !item.reservable });
      toast({
        title: 'Item Updated',
        description: `${item.name} is now ${!item.reservable ? 'reservable' : 'not reservable'}.`,
      });
    } catch (error) {
      console.error('Failed to update item:', error);
      toast({
        title: 'Error',
        description: 'Could not update the item. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenEditDialog = (item: FoodItem) => {
    setItemToEdit(item);
    setEditName(item.name);
    setEditDescription(item.description);
    setEditPrice(item.price ? item.price.toString() : '');
  };

  const handleSaveChanges = async () => {
    if (!itemToEdit || !firestore) return;
    setIsSavingEdit(true);

    try {
      const itemRef = doc(firestore, 'foodItems', itemToEdit.id);
      await updateDoc(itemRef, {
        name: editName,
        description: editDescription,
        price: parseFloat(editPrice),
      });
      toast({
        title: 'Changes Saved',
        description: `${editName} has been updated successfully.`,
      });
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast({
        title: 'Error Saving',
        description: 'Could not save the changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingEdit(false);
      setItemToEdit(null);
    }
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    doc.text("Current Food Reservations", 14, 16);

    const tableColumn = ["Date", "Customer", "Phone", "Orders", "Comment", "Total"];
    const tableRows: (string | number)[][] = [];

    customerOrders.forEach(order => {
        const orderDetails = order.orders.map(o => {
            const foodItem = foodItems.find(item => item.id === o.foodItemId);
            return `${o.quantity}x ${foodItem?.name || 'Unknown Item'}`;
        }).join(', ');
        
        const firstComment = order.orders.find(o => o.comment)?.comment || 'N/A';

        const rowData = [
            order.lastOrderDate.toLocaleDateString(),
            `${order.customer.firstName} ${order.customer.lastName}`,
            order.customer.phoneNumber || 'N/A',
            orderDetails,
            firstComment,
            `$${order.totalSpent.toFixed(2)}`
        ];
        tableRows.push(rowData);
    });

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
    });

    doc.save("food-orders.pdf");
    toast({ title: 'Download Started', description: 'Your orders PDF is being downloaded.' });
  };

  const handleClearReport = async () => {
    if (!firestore || customers.length === 0) {
      toast({ title: 'Error', description: 'Firestore or customers not available.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    let deletedCount = 0;
    
    try {
      const batch = writeBatch(firestore);
      
      // Iterate through each customer to find their fulfilled orders
      for (const customer of customers) {
        const fulfilledOrdersQuery = query(
          collection(firestore, 'customers', customer.id, 'orders'),
          where('status', '==', 'fulfilled')
        );
        const snapshot = await getDocs(fulfilledOrdersQuery);
        
        if (!snapshot.empty) {
          snapshot.forEach(doc => {
            batch.delete(doc.ref);
            deletedCount++;
          });
        }
      }

      if (deletedCount > 0) {
        await batch.commit();
        toast({ title: 'Report Cleared', description: `${deletedCount} fulfilled order(s) have been deleted.` });
      } else {
        toast({ title: 'No Fulfilled Orders', description: 'There were no fulfilled orders to clear.' });
      }

    } catch (error) {
      console.error("Failed to clear report:", error);
      toast({ title: 'Error', description: 'Could not clear the report. Check permissions and try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setIsReportOpen(false);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setLogoFile(selectedFile);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    if (selectedFile) {
      setLogoPreviewUrl(URL.createObjectURL(selectedFile));
    } else {
      setLogoPreviewUrl(null);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !firestore) {
      toast({ title: 'No Logo Selected', description: 'Please select an image file to upload.', variant: 'destructive' });
      return;
    }
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', logoFile);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.secure_url) throw new Error('Cloudinary upload failed for logo');

      await setDoc(doc(firestore, 'settings/app'), { logoUrl: data.secure_url }, { merge: true });
      toast({ title: 'Logo Updated', description: 'The application logo has been changed.' });
      setLogoFile(null);
      setLogoPreviewUrl(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'Logo Upload Failed', description: 'Could not upload the new logo.', variant: 'destructive' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (!isAuthorized) {
    return <PinEntryForm onCorrectPin={() => setIsAuthorized(true)} correctPin={ADMIN_PIN} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
         <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <SettingsIcon className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Application Settings</DialogTitle>
              <DialogDescription>Manage global application settings.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="reservations-switch" className="font-medium">
                    {settings?.reservationsOpen !== false ? 'Reservations Open' : 'Reservations Closed'}
                  </Label>
                  <p className="text-xs text-muted-foreground">Control whether users can place new orders.</p>
                </div>
                <Switch
                  id="reservations-switch"
                  checked={settings?.reservationsOpen !== false}
                  onCheckedChange={handleSetReservationsOpen}
                  disabled={settingsLoading}
                />
              </div>
              <div className="space-y-4 rounded-lg border p-4">
                <Label className="font-medium">Application Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20">
                    <Image
                      src={logoPreviewUrl || settings?.logoUrl || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTCg8hNBMeem6nDsPPTCCqkykynaqVzAgrRwQ&s"}
                      alt="Current Logo"
                      layout="fill"
                      objectFit="cover"
                      className="rounded-md border bg-muted"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input id="logo-upload" type="file" accept="image/*" onChange={handleLogoFileChange} />
                    <Button onClick={handleLogoUpload} disabled={isUploadingLogo || !logoFile} className="w-full">
                      {isUploadingLogo ? 'Uploading...' : 'Upload New Logo'}
                      <Upload className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8 h-fit">
           <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Current Orders ({customerOrders.reduce((acc, curr) => acc + curr.orders.length, 0)})
                </CardTitle>
                <CardDescription>Reservations waiting to be fulfilled.</CardDescription>
              </div>
              <div className="flex gap-2 shrink-0">
                  <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
                    <DialogTrigger asChild>
                       <Button variant="outline" size="sm" disabled={orders.length === 0}>
                        <BarChart className="h-4 w-4 mr-2"/>
                        Report
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Weekly Report</DialogTitle>
                        <DialogDescription>Summary of orders from the last 7 days.</DialogDescription>
                      </DialogHeader>
                      {weeklyReport.itemsSold.length > 0 ? (
                        <div className="space-y-4">
                           <div className="max-h-[300px] overflow-y-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-right">Quantity Sold</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {weeklyReport.itemsSold.map(([name, quantity]) => (
                                    <TableRow key={name}>
                                      <TableCell className="font-medium">{name}</TableCell>
                                      <TableCell className="text-right">{quantity}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                          </div>
                          <div className="flex justify-end items-center pt-4 border-t">
                            <span className="text-muted-foreground mr-2">Total Revenue:</span>
                            <span className="font-bold text-lg">${weeklyReport.totalRevenue.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                         <div className="text-center text-muted-foreground py-10">
                          <CircleOff className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-2 text-sm font-medium">No Orders This Week</h3>
                          <p className="mt-1 text-sm">No orders have been placed in the last 7 days.</p>
                        </div>
                      )}
                      <DialogFooter>
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isSubmitting}>
                              <Eraser className="mr-2 h-4 w-4" />
                              {isSubmitting ? 'Clearing...' : 'Clear Fulfilled Orders'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete all fulfilled orders from the database. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClearReport}>
                                Confirm & Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={customerOrders.length === 0}>
                    <Download className="h-4 w-4 mr-2"/>
                    PDF
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
              {customerOrders.length > 0 ? (
                <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Orders</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {customerOrders.map(({ customer, orders: customerOrderList, totalSpent, lastOrderDate }) => (
                            <TableRow key={customer.id}>
                            <TableCell className="font-medium whitespace-nowrap align-top">
                                <div className="flex flex-col gap-2">
                                    <div className="text-xs text-muted-foreground">{lastOrderDate.toLocaleDateString()}</div>
                                    <div>{customer.firstName} {customer.lastName}</div>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="w-full justify-start">
                                          <CheckCircle2 className="mr-2 h-4 w-4"/>
                                          Fulfill
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Fulfill Orders?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            This will mark all pending orders for {customer.firstName} {customer.lastName} as fulfilled. This action cannot be undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleFulfillCustomerOrders(customer)}>
                                            Confirm
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </TableCell>
                            <TableCell className="align-top">
                                <div className="flex flex-col gap-1">
                                {customerOrderList.map(order => {
                                    const foodItem = foodItems.find(item => item.id === order.foodItemId);
                                    return (
                                    <div key={order.id} className="text-sm flex flex-col gap-2">
                                       <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="font-normal">{order.quantity}x</Badge>
                                            <span>{foodItem?.name || 'Unknown Item'}</span>
                                       </div>
                                       {order.comment && (
                                            <div className="flex items-start gap-2 text-muted-foreground pl-2 border-l ml-2">
                                                <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                                                <p className="text-xs italic">{order.comment}</p>
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                                </div>
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap align-top text-right">
                                ${totalSpent.toFixed(2)}
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-10">
                  <CircleOff className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium">No Pending Orders</h3>
                  <p className="mt-1 text-sm">When customers make reservations, they will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <PackageOpen className="h-5 w-5" />
                  Current Menu
                </CardTitle>
                <CardDescription>The food items currently available for customers to reserve.</CardDescription>
              </div>
              <Dialog onOpenChange={(open) => !open && resetAddForm()}>
                  <DialogTrigger asChild>
                     <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add New Item
                      </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add Menu Item</DialogTitle>
                      <DialogDescription>Create a new food item available for reservation.</DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[calc(100vh-12rem)]">
                        <div className="space-y-4 py-4 px-6">
                            <div className="space-y-2">
                                <Label htmlFor="food-name">Food Name</Label>
                                <Input id="food-name" type="text" placeholder="e.g., Gourmet Burger" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="food-description">Description</Label>
                                <Textarea id="food-description" placeholder="Describe the item..." value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="food-price">Price</Label>
                                <Input id="food-price" type="number" placeholder="e.g., 12.99" value={price} onChange={(e) => setPrice(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="food-image">Image</Label>
                                <p className="text-xs text-muted-foreground">Recommended: 400x240 pixels.</p>
                                <Input id="food-image" type="file" accept="image/*" onChange={handleFileChange} />
                            </div>
                            {previewUrl && (
                                <div className="relative">
                                <Image src={previewUrl} alt="Preview" width={400} height={240} className="rounded-md object-cover aspect-video w-full" />
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <DialogFooter>
                      <DialogClose asChild>
                         <Button
                            onClick={async () => {
                                const success = await handleAddFood();
                                if (!success) {
                                  // This keeps the dialog open on failure, but requires a manual close
                                  // To auto-close, we would need to control dialog open state.
                                  // For now, this is a reasonable UX.
                                  return;
                                }
                              }}
                            disabled={!isAddDialogVali || isSubmitting}
                            >
                                {isSubmitting ? 'Adding...' : 'Add Food Item'}
                            </Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
              {foodItems.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {foodItems.map((item) => (
                    <Card key={item.id} className="flex flex-col">
                      <CardContent className="p-0 relative">
                         <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="absolute top-2 right-2 z-20 h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete "{item.name}" from the menu. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveItem(item)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                         {!item.reservable && (
                            <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center rounded-t-lg">
                               <Badge variant="destructive" className="text-lg">Closed</Badge>
                            </div>
                         )}
                        <Image src={item.imageUrl} alt={item.name} width={400} height={240} className="rounded-t-lg object-cover aspect-video w-full" />
                      </CardContent>
                      <div className="p-4 flex flex-col flex-grow">
                        <div className="flex justify-between items-start">
                            <h3 className="font-semibold">{item.name}</h3>
                            <Badge variant={item.reservable ? "default" : "destructive"}>${typeof item.price === 'number' ? item.price.toFixed(2) : '0.00'}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex-grow mt-1">{item.description}</p>
                      </div>
                      <CardFooter className="flex gap-2">
                        <Button variant="default" className="w-full" onClick={() => handleOpenEditDialog(item)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                         <Button variant={item.reservable ? 'outline' : 'default'} className="w-full" onClick={() => handleToggleReservable(item)}>
                          {item.reservable ? <Ban className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                          {item.reservable ? 'Close' : 'Open'}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-10">
                  <CircleOff className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium">No Food Items</h3>
                  <p className="mt-1 text-sm">Add a new item to get started.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!itemToEdit} onOpenChange={(isOpen) => !isOpen && setItemToEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Make changes to the item details below. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-food-name">Food Name</Label>
              <Input
                id="edit-food-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Gourmet Burger"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-food-description">Description</Label>
              <Textarea
                id="edit-food-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe the item..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-food-price">Price</Label>
              <Input
                id="edit-food-price"
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="e.g., 12.99"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleSaveChanges} disabled={isSavingEdit}>
              {isSavingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    