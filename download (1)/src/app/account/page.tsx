'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AuthError, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import {
  doc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  query,
  DocumentData,
} from 'firebase/firestore';
import { User, Trash2, AlertTriangle } from 'lucide-react';

interface CustomerProfile extends DocumentData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
}

export default function AccountPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const customerDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'customers', user.uid) : null), [firestore, user]);
  const { data: customerProfile, isLoading: isProfileLoading } = useDoc<CustomerProfile>(customerDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const getFirebaseErrorMessage = (error: AuthError) => {
    switch (error.code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'The password you entered is incorrect.';
      case 'auth/requires-recent-login':
        return 'This operation is sensitive and requires a recent login. Please log out and log back in.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !auth || !firestore || !password) {
      toast({
        title: 'Error',
        description: 'Could not delete account. Missing information.',
        variant: 'destructive',
      });
      return;
    }
    setIsDeleting(true);

    try {
      // 1. Re-authenticate the user
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(user, credential);

      // 2. Delete user's orders (in a batch)
      const ordersQuery = query(collection(firestore, 'customers', user.uid, 'orders'));
      const ordersSnapshot = await getDocs(ordersQuery);
      if (!ordersSnapshot.empty) {
        const batch = writeBatch(firestore);
        ordersSnapshot.forEach((orderDoc) => {
          batch.delete(orderDoc.ref);
        });
        await batch.commit();
      }

      // 3. Delete user's customer document
      await deleteDoc(doc(firestore, 'customers', user.uid));

      // 4. Delete the Firebase Auth user
      await deleteUser(user);

      toast({
        title: 'Account Deleted',
        description: 'Your account and all associated data have been permanently removed.',
      });

      // User is automatically logged out. Redirect to login.
      router.push('/login');
    } catch (error) {
      toast({
        title: 'Deletion Failed',
        description: getFirebaseErrorMessage(error as AuthError),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setIsDialogOpen(false);
      setPassword('');
    }
  };

  if (isUserLoading || !user || isProfileLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <div className="mx-auto bg-primary/20 text-primary p-3 rounded-full w-fit mb-4">
          <User className="h-8 w-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-headline font-bold">My Account</h1>
        <p className="text-muted-foreground mt-2">Manage your profile and account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Full Name</span>
            <span className="font-medium">{user.displayName || 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email Address</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Phone Number</span>
            <span className="font-medium">{customerProfile?.phoneNumber || 'Not set'}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Close Account
          </CardTitle>
          <CardDescription>
            This action is permanent and cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Deleting your account will permanently remove your profile, all of your reservation history, and any other associated data.
          </p>
        </CardContent>
        <CardFooter>
          <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete My Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account. To confirm, please enter your password.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                <Label htmlFor="password-confirm">Password</Label>
                <Input
                  id="password-confirm"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPassword('')}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} disabled={isDeleting || !password}>
                  {isDeleting ? 'Deleting...' : 'Confirm & Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
