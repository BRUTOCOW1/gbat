import { Routes } from '@angular/router';
import {GolfShotComponent} from './golf-shot/golf-shot.component';
import {GolfBagComponent} from './golf-bag/golf-bag.component';
import {GolfClubComponent} from './golf-club/golf-club.component';
import {LoginComponent} from './login/login.component';
import { AuthGuard } from './guards/auth.guard';
import {BlogComponent} from './blog/blog.component';
import { RegisterComponent } from './register/register.component';
import { ProfileComponent } from './profile/profile.component';
import { GolfRoundComponent } from './golf-round/golf-round.component';
import { CreateGolfBagComponent } from './create-golf-bag/create-golf-bag.component';
import { GolfHoleComponent } from './golf-hole/golf-hole.component';
import { GolfCourseComponent } from './golf-course/golf-course.component';
import { NewRoundComponent } from './new-round/new-round.component';


export const routes: Routes = [
    // ✅ Alphabetized Components
    { path: 'blog-component', component: BlogComponent },
    { path: 'dashboard', component: GolfRoundComponent, canActivate: [AuthGuard] },
    { path: 'golf-bags', component: GolfBagComponent },
    { path: 'golf-bag/:id', component: GolfBagComponent },
    { path: 'golf-clubs', component: GolfClubComponent },
    { path: 'golf-courses', component: GolfCourseComponent }, // ✅ Added
    { path: 'golf-hole/:holeNumber', component: GolfHoleComponent },
    { path: 'golf-shot/:holeNumber', component: GolfShotComponent },
    { path: 'add-clubs', component: GolfClubComponent },
    // { path: 'golf-shot/:holeId/:userId/:golfBagId', component: GolfShotComponent },
    { path: 'login', component: LoginComponent },
    { path: 'new-bag', component: CreateGolfBagComponent },
    { path: 'profile', component: ProfileComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'new-round', component: NewRoundComponent},
  
    // ✅ Organized Redirects
    { path: 'blog-component/golf-component', redirectTo: 'golf-component' },
    { path: 'golf-component/blog-component', redirectTo: 'blog-component' },
    { path: 'golf-component/golf-shot-component', redirectTo: 'golf-shot-component' },
    { path: 'golf-component/round-component', redirectTo: 'round-component' },
    { path: 'golf-shot-component/golf-component', redirectTo: 'golf-component' },
    { path: '*/login-component', redirectTo: 'login' },
  
    // ✅ Default Fallback (Optional)
    { path: '**', redirectTo: 'dashboard' },
  ];
  